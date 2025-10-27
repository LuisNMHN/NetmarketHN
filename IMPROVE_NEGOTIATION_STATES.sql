-- =========================================================
-- MEJORA DEL SISTEMA DE ESTADOS DE NEGOCIACIÓN
-- =========================================================
-- Este script mejora la experiencia de usuario cuando una solicitud
-- entra en estado de negociación, evitando conflictos entre usuarios
-- =========================================================

-- 1. Agregar campos adicionales para mejor control de negociación
ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS negotiating_with UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS negotiation_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS negotiation_timeout_at TIMESTAMP WITH TIME ZONE;

-- 2. Crear función para iniciar negociación
CREATE OR REPLACE FUNCTION start_negotiation(
    p_request_id UUID,
    p_seller_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status VARCHAR(20);
    v_buyer_id UUID;
BEGIN
    -- Obtener estado actual y comprador
    SELECT status, buyer_id INTO v_current_status, v_buyer_id
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verificar que la solicitud existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    -- Verificar que no es el mismo usuario (comprador no puede negociar consigo mismo)
    IF v_buyer_id = p_seller_id THEN
        RAISE EXCEPTION 'No puedes negociar tu propia solicitud';
    END IF;
    
    -- Verificar que la solicitud está activa
    IF v_current_status != 'active' THEN
        RAISE EXCEPTION 'Esta solicitud no está disponible para negociación';
    END IF;
    
    -- Cambiar estado a negociando
    UPDATE purchase_requests 
    SET 
        status = 'negotiating',
        negotiating_with = p_seller_id,
        negotiation_started_at = NOW(),
        negotiation_timeout_at = NOW() + INTERVAL '2 hours', -- Timeout de 2 horas
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Crear notificación para el comprador
    INSERT INTO request_notifications (user_id, request_id, type, title, message)
    VALUES (
        v_buyer_id, 
        p_request_id, 
        'negotiation_started', 
        'Negociación iniciada', 
        'Un vendedor ha iniciado negociación sobre tu solicitud'
    );
    
    RETURN TRUE;
END;
$$;

-- 3. Crear función para finalizar negociación (sin acuerdo)
CREATE OR REPLACE FUNCTION end_negotiation_no_deal(
    p_request_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status VARCHAR(20);
    v_negotiating_with UUID;
    v_buyer_id UUID;
BEGIN
    -- Obtener información actual
    SELECT status, negotiating_with, buyer_id 
    INTO v_current_status, v_negotiating_with, v_buyer_id
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verificar que la solicitud existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    -- Verificar que está en negociación
    IF v_current_status != 'negotiating' THEN
        RAISE EXCEPTION 'Esta solicitud no está en negociación';
    END IF;
    
    -- Verificar permisos (solo el comprador o el vendedor pueden finalizar)
    IF p_user_id != v_buyer_id AND p_user_id != v_negotiating_with THEN
        RAISE EXCEPTION 'No tienes permisos para finalizar esta negociación';
    END IF;
    
    -- Volver a estado activo
    UPDATE purchase_requests 
    SET 
        status = 'active',
        negotiating_with = NULL,
        negotiation_started_at = NULL,
        negotiation_timeout_at = NULL,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Crear notificaciones
    INSERT INTO request_notifications (user_id, request_id, type, title, message)
    VALUES 
    (v_buyer_id, p_request_id, 'negotiation_ended', 'Negociación finalizada', 'La negociación ha terminado sin acuerdo'),
    (v_negotiating_with, p_request_id, 'negotiation_ended', 'Negociación finalizada', 'La negociación ha terminado sin acuerdo');
    
    RETURN TRUE;
END;
$$;

-- 4. Crear función para aceptar oferta durante negociación
CREATE OR REPLACE FUNCTION accept_offer_during_negotiation(
    p_request_id UUID,
    p_buyer_id UUID,
    p_negotiated_amount DECIMAL(15,2),
    p_negotiated_terms TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_seller_id UUID;
    v_current_status VARCHAR(20);
    v_exchange_rate DECIMAL(10,4);
BEGIN
    -- Obtener información actual
    SELECT status, negotiating_with, exchange_rate
    INTO v_current_status, v_seller_id, v_exchange_rate
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verificar que la solicitud existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    -- Verificar que está en negociación
    IF v_current_status != 'negotiating' THEN
        RAISE EXCEPTION 'Esta solicitud no está en negociación';
    END IF;
    
    -- Verificar que el usuario es el comprador
    IF NOT EXISTS (SELECT 1 FROM purchase_requests WHERE id = p_request_id AND buyer_id = p_buyer_id) THEN
        RAISE EXCEPTION 'No tienes permisos para aceptar esta oferta';
    END IF;
    
    -- Cambiar estado a aceptado
    UPDATE purchase_requests 
    SET 
        status = 'accepted',
        seller_id = v_seller_id,
        accepted_at = NOW(),
        terms = p_negotiated_terms,
        amount = p_negotiated_amount,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Crear transacción
    INSERT INTO purchase_transactions (
        id, request_id, buyer_id, seller_id, amount, exchange_rate, final_amount
    ) VALUES (
        v_transaction_id, p_request_id, p_buyer_id, v_seller_id, 
        p_negotiated_amount, v_exchange_rate, p_negotiated_amount
    );
    
    -- Crear notificaciones
    INSERT INTO request_notifications (user_id, request_id, type, title, message)
    VALUES 
    (p_buyer_id, p_request_id, 'offer_accepted', 'Oferta aceptada', 'Has aceptado la oferta negociada. Procede con el pago.'),
    (v_seller_id, p_request_id, 'offer_accepted', 'Tu oferta fue aceptada', 'El comprador ha aceptado tu oferta negociada. Espera el pago.');
    
    RETURN v_transaction_id;
END;
$$;

-- 5. Crear función para limpiar negociaciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_negotiations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Volver a activo las negociaciones expiradas
    UPDATE purchase_requests 
    SET 
        status = 'active',
        negotiating_with = NULL,
        negotiation_started_at = NULL,
        negotiation_timeout_at = NULL,
        updated_at = NOW()
    WHERE 
        status = 'negotiating' 
        AND negotiation_timeout_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Crear notificaciones para usuarios afectados
    INSERT INTO request_notifications (user_id, request_id, type, title, message)
    SELECT 
        buyer_id, 
        id, 
        'negotiation_expired', 
        'Negociación expirada', 
        'La negociación ha expirado por tiempo'
    FROM purchase_requests 
    WHERE 
        status = 'active' 
        AND negotiating_with IS NULL 
        AND negotiation_started_at IS NOT NULL;
    
    RETURN v_count;
END;
$$;

-- 6. Crear función para obtener solicitudes disponibles (excluyendo las en negociación)
CREATE OR REPLACE FUNCTION get_available_purchase_requests(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    currency VARCHAR(10),
    description TEXT,
    status VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_name TEXT,
    buyer_email TEXT,
    offers_count BIGINT,
    unique_code TEXT,
    payment_method VARCHAR(50),
    bank_name TEXT,
    custom_bank_name TEXT,
    country TEXT,
    custom_country TEXT,
    digital_wallet VARCHAR(50),
    currency_type VARCHAR(10),
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    processing_fee_percentage DECIMAL(5,2),
    processing_fee_amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    payment_reference TEXT,
    payment_status VARCHAR(20),
    negotiating_with UUID,
    negotiation_started_at TIMESTAMP WITH TIME ZONE,
    negotiation_timeout_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.buyer_id,
        pr.amount,
        pr.currency,
        pr.description,
        pr.status,
        pr.expires_at,
        pr.created_at,
        pr.updated_at,
        up.display_name as buyer_name,
        au.email as buyer_email,
        COALESCE(offers.count, 0) as offers_count,
        pr.metadata->>'unique_code' as unique_code,
        pr.metadata->>'payment_method' as payment_method,
        pr.metadata->>'bank_name' as bank_name,
        pr.metadata->>'custom_bank_name' as custom_bank_name,
        pr.metadata->>'country' as country,
        pr.metadata->>'custom_country' as custom_country,
        pr.metadata->>'digital_wallet' as digital_wallet,
        pr.metadata->>'currency_type' as currency_type,
        (pr.metadata->>'amount_in_original_currency')::DECIMAL(15,2) as amount_in_original_currency,
        (pr.metadata->>'exchange_rate_applied')::DECIMAL(10,4) as exchange_rate_applied,
        (pr.metadata->>'processing_fee_percentage')::DECIMAL(5,2) as processing_fee_percentage,
        (pr.metadata->>'processing_fee_amount')::DECIMAL(15,2) as processing_fee_amount,
        (pr.metadata->>'final_amount_hnld')::DECIMAL(15,2) as final_amount_hnld,
        pr.metadata->>'payment_reference' as payment_reference,
        pr.metadata->>'payment_status' as payment_status,
        pr.negotiating_with,
        pr.negotiation_started_at,
        pr.negotiation_timeout_at
    FROM purchase_requests pr
    LEFT JOIN user_profiles up ON pr.buyer_id = up.user_id
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN (
        SELECT request_id, COUNT(*) as count
        FROM purchase_offers
        GROUP BY request_id
    ) offers ON pr.id = offers.request_id
    WHERE 
        pr.status = 'active'  -- Solo solicitudes activas
        AND pr.buyer_id != p_user_id  -- Excluir las propias
        AND (pr.negotiating_with IS NULL OR pr.negotiating_with = p_user_id)  -- Solo las no negociadas o donde el usuario está negociando
        AND pr.expires_at > NOW()  -- No expiradas
    ORDER BY pr.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 7. Función para limpieza automática de negociaciones expiradas
-- Nota: PostgreSQL no permite triggers AFTER SELECT, por lo que la limpieza
-- se ejecutará manualmente o mediante un job programado
-- 
-- Para ejecutar la limpieza manualmente:
-- SELECT cleanup_expired_negotiations();
--
-- Para automatizar, crear un job que ejecute esta función cada 15 minutos:
-- pg_cron.schedule('cleanup-negotiations', '*/15 * * * *', 'SELECT cleanup_expired_negotiations();');

-- 7.5. Corregir constraint de tipos de notificación
-- Eliminar constraint existente
ALTER TABLE request_notifications 
DROP CONSTRAINT IF EXISTS request_notifications_type_check;

-- Crear nuevo constraint con todos los tipos
ALTER TABLE request_notifications 
ADD CONSTRAINT request_notifications_type_check 
CHECK (type IN (
    'new_request',
    'new_offer', 
    'offer_accepted',
    'offer_rejected',
    'payment_sent',
    'payment_confirmed',
    'transaction_completed',
    'request_expired',
    'request_cancelled',
    -- Nuevos tipos de negociación
    'negotiation_started',
    'negotiation_ended',
    'negotiation_expired'
));

-- 8. Actualizar políticas RLS para incluir nuevos campos
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Política para lectura de solicitudes disponibles
DROP POLICY IF EXISTS "Users can view available purchase requests" ON purchase_requests;
CREATE POLICY "Users can view available purchase requests" ON purchase_requests
    FOR SELECT USING (
        status = 'active' 
        AND buyer_id != auth.uid() 
        AND (negotiating_with IS NULL OR negotiating_with = auth.uid())
    );

-- Política para actualización durante negociación
DROP POLICY IF EXISTS "Users can update their own requests" ON purchase_requests;
CREATE POLICY "Users can update their own requests" ON purchase_requests
    FOR UPDATE USING (
        buyer_id = auth.uid() OR negotiating_with = auth.uid()
    );

-- 9. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_negotiating 
ON purchase_requests(status, negotiating_with) 
WHERE status = 'negotiating';

CREATE INDEX IF NOT EXISTS idx_purchase_requests_negotiation_timeout 
ON purchase_requests(negotiation_timeout_at) 
WHERE status = 'negotiating';

-- 10. Comentarios para documentación
COMMENT ON FUNCTION start_negotiation IS 'Inicia una negociación bloqueando la solicitud para otros usuarios';
COMMENT ON FUNCTION end_negotiation_no_deal IS 'Finaliza una negociación sin acuerdo, liberando la solicitud';
COMMENT ON FUNCTION accept_offer_during_negotiation IS 'Acepta una oferta durante la negociación';
COMMENT ON FUNCTION cleanup_expired_negotiations IS 'Limpia negociaciones expiradas automáticamente';
COMMENT ON FUNCTION get_available_purchase_requests IS 'Obtiene solo solicitudes disponibles para negociación';

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================

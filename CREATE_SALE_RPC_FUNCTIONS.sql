-- =========================================================
-- FUNCIONES RPC PARA SISTEMA DE VENTAS
-- =========================================================
-- Funciones para crear y gestionar solicitudes de venta
-- =========================================================

-- Función para generar código único (reutilizar si existe, sino crear)
CREATE OR REPLACE FUNCTION generate_unique_sale_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    date_part TEXT;
    random_part TEXT;
BEGIN
    -- Generar parte de fecha (YYYYMMDD)
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Generar parte aleatoria (6 caracteres)
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 6));
    
    -- Combinar: NMHN-VENTA-YYYYMMDD-XXXXXX
    new_code := 'NMHN-VENTA-' || date_part || '-' || random_part;
    
    -- Verificar si ya existe
    SELECT EXISTS(SELECT 1 FROM sale_requests WHERE unique_code = new_code) INTO code_exists;
    
    -- Si existe, generar uno nuevo (máximo 10 intentos)
    FOR i IN 1..10 LOOP
        IF NOT code_exists THEN
            EXIT;
        END IF;
        random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT || i::TEXT) FROM 1 FOR 6));
        new_code := 'NMHN-VENTA-' || date_part || '-' || random_part;
        SELECT EXISTS(SELECT 1 FROM sale_requests WHERE unique_code = new_code) INTO code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Función para crear solicitud de venta
CREATE OR REPLACE FUNCTION create_sale_request(
    p_seller_id UUID,
    p_amount DECIMAL(15,2), -- Monto en HNLD que se quiere vender
    p_description TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 7,
    p_payment_method TEXT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_custom_bank_name TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL,
    p_custom_country TEXT DEFAULT NULL,
    p_digital_wallet TEXT DEFAULT NULL,
    p_currency_type TEXT DEFAULT 'L',
    p_amount_in_original_currency DECIMAL(15,2) DEFAULT NULL,
    p_exchange_rate_applied DECIMAL(10,4) DEFAULT 1.0000,
    p_processing_fee_percentage DECIMAL(5,2) DEFAULT NULL,
    p_processing_fee_amount DECIMAL(15,2) DEFAULT NULL,
    p_final_amount_hnld DECIMAL(15,2) DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL,
    p_payment_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (
    success BOOLEAN,
    id UUID,
    unique_code TEXT,
    message TEXT,
    debug_info TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_request_id UUID;
    generated_code TEXT;
    expires_at TIMESTAMP WITH TIME ZONE;
    v_final_amount DECIMAL(15,2);
BEGIN
    -- Validar que el usuario tenga suficiente saldo HNLD
    -- (esto se puede verificar después, por ahora solo creamos la solicitud)
    
    -- Generar código único
    generated_code := generate_unique_sale_code();
    
    -- Calcular fecha de expiración
    expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    
    -- Determinar monto final en HNLD
    v_final_amount := COALESCE(p_final_amount_hnld, p_amount);
    
    -- Insertar nueva solicitud de venta
    INSERT INTO sale_requests (
        seller_id,
        amount,
        description,
        expires_at,
        payment_method,
        bank_name,
        custom_bank_name,
        country,
        custom_country,
        digital_wallet,
        currency_type,
        amount_in_original_currency,
        exchange_rate_applied,
        processing_fee_percentage,
        processing_fee_amount,
        final_amount_hnld,
        payment_reference,
        payment_status,
        unique_code,
        status
    ) VALUES (
        p_seller_id,
        p_amount,
        p_description,
        expires_at,
        p_payment_method,
        p_bank_name,
        p_custom_bank_name,
        p_country,
        p_custom_country,
        p_digital_wallet,
        p_currency_type,
        p_amount_in_original_currency,
        p_exchange_rate_applied,
        p_processing_fee_percentage,
        p_processing_fee_amount,
        v_final_amount,
        p_payment_reference,
        p_payment_status,
        generated_code,
        'active'
    ) RETURNING id INTO new_request_id;
    
    -- Retornar resultado exitoso
    RETURN QUERY SELECT 
        TRUE,
        new_request_id,
        generated_code,
        'Solicitud de venta creada exitosamente'::TEXT,
        ('Request ID: ' || new_request_id || ', Code: ' || generated_code)::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        RETURN QUERY SELECT 
            FALSE, 
            NULL::UUID, 
            NULL::TEXT, 
            ('Error: ' || SQLERRM)::TEXT,
            ('Error code: ' || SQLSTATE)::TEXT;
END;
$$;

-- Función para obtener solicitudes de venta activas (para compradores)
CREATE OR REPLACE FUNCTION get_active_sale_requests(
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    currency_type TEXT,
    payment_method TEXT,
    bank_name TEXT,
    country TEXT,
    unique_code TEXT,
    status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    seller_name TEXT,
    seller_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.seller_id,
        sr.amount,
        sr.final_amount_hnld,
        sr.currency_type,
        sr.payment_method,
        sr.bank_name,
        sr.country,
        sr.unique_code,
        sr.status,
        sr.expires_at,
        sr.created_at,
        COALESCE(p.full_name, u.email) as seller_name,
        u.email as seller_email
    FROM sale_requests sr
    JOIN auth.users u ON u.id = sr.seller_id
    LEFT JOIN profiles p ON p.id = sr.seller_id
    WHERE sr.status = 'active'
      AND sr.expires_at > NOW()
      AND sr.seller_id != p_user_id -- Excluir propias solicitudes
      AND sr.payment_method != 'card' -- Excluir tarjetas (similar a compras)
    ORDER BY sr.created_at DESC;
END;
$$;

-- Función para obtener solicitudes de venta del usuario
CREATE OR REPLACE FUNCTION get_user_sale_requests(
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    currency_type TEXT,
    payment_method TEXT,
    bank_name TEXT,
    country TEXT,
    unique_code TEXT,
    status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.seller_id,
        sr.buyer_id,
        sr.amount,
        sr.final_amount_hnld,
        sr.currency_type,
        sr.payment_method,
        sr.bank_name,
        sr.country,
        sr.unique_code,
        sr.status,
        sr.expires_at,
        sr.created_at,
        sr.accepted_at
    FROM sale_requests sr
    WHERE sr.seller_id = p_user_id
    ORDER BY sr.created_at DESC;
END;
$$;

-- Función para cancelar solicitud de venta
CREATE OR REPLACE FUNCTION cancel_sale_request(
    p_request_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller_id UUID;
BEGIN
    -- Verificar que la solicitud pertenece al usuario
    SELECT seller_id INTO v_seller_id
    FROM sale_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF v_seller_id != p_user_id THEN
        RETURN FALSE;
    END IF;
    
    -- Solo se puede cancelar si está activa o negociando
    UPDATE sale_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_request_id
      AND status IN ('active', 'negotiating');
    
    RETURN FOUND;
END;
$$;

-- Función para aceptar solicitud de venta (crear transacción)
CREATE OR REPLACE FUNCTION accept_sale_request(
    p_request_id UUID,
    p_buyer_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    transaction_id UUID,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request sale_requests%ROWTYPE;
    v_transaction_id UUID;
    v_seller_id UUID;
BEGIN
    -- Obtener la solicitud
    SELECT * INTO v_request
    FROM sale_requests
    WHERE id = p_request_id
      AND status = 'active'
      AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Solicitud no encontrada o no disponible'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar que no sea el mismo usuario
    IF v_request.seller_id = p_buyer_id THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'No puedes comprar tu propia solicitud'::TEXT;
        RETURN;
    END IF;
    
    v_seller_id := v_request.seller_id;
    
    -- Crear transacción de venta
    INSERT INTO sale_transactions (
        request_id,
        seller_id,
        buyer_id,
        amount,
        currency,
        exchange_rate,
        hnld_amount,
        payment_method,
        status,
        escrow_amount,
        escrow_status,
        payment_deadline,
        verification_deadline
    ) VALUES (
        p_request_id,
        v_seller_id,
        p_buyer_id,
        COALESCE(v_request.amount_in_original_currency, v_request.amount),
        v_request.currency_type,
        v_request.exchange_rate_applied,
        v_request.final_amount_hnld,
        v_request.payment_method,
        'pending',
        v_request.final_amount_hnld, -- HNLD bloqueados en escrow
        'protected',
        NOW() + INTERVAL '24 hours', -- Deadline para pago
        NOW() + INTERVAL '48 hours'  -- Deadline para verificación
    ) RETURNING id INTO v_transaction_id;
    
    -- Crear pasos de la transacción
    INSERT INTO sale_transaction_steps (transaction_id, step_order, step_name, status)
    VALUES
        (v_transaction_id, 1, 'Trato aceptado', 'completed'),
        (v_transaction_id, 2, 'Pago iniciado', 'pending'),
        (v_transaction_id, 3, 'Pago verificado', 'pending'),
        (v_transaction_id, 4, 'HNLD liberados', 'pending');
    
    -- Actualizar solicitud
    UPDATE sale_requests
    SET status = 'accepted',
        buyer_id = p_buyer_id,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    RETURN QUERY SELECT TRUE, v_transaction_id, 'Transacción creada exitosamente'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, ('Error: ' || SQLERRM)::TEXT;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION create_sale_request IS 'Crear nueva solicitud de venta HNLD';
COMMENT ON FUNCTION get_active_sale_requests IS 'Obtener solicitudes de venta activas para compradores';
COMMENT ON FUNCTION get_user_sale_requests IS 'Obtener solicitudes de venta del usuario';
COMMENT ON FUNCTION cancel_sale_request IS 'Cancelar solicitud de venta';
COMMENT ON FUNCTION accept_sale_request IS 'Aceptar solicitud de venta y crear transacción';


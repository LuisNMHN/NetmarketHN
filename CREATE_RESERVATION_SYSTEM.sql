-- =========================================================
-- SISTEMA DE RESERVAS PARA NEGOCIACIONES
-- =========================================================
-- Este sistema permite que un vendedor "reserve" una solicitud
-- mientras negocia, ocultándola de otros vendedores
-- =========================================================

-- PASO 1: Crear tabla de reservas de negociación
CREATE TABLE IF NOT EXISTS negotiation_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Solo puede haber una reserva activa por solicitud
    UNIQUE (request_id, status)
);

-- PASO 2: Agregar constraint para el status
ALTER TABLE negotiation_reservations
ADD CONSTRAINT negotiation_reservations_status_check
CHECK (status IN ('active', 'completed', 'expired', 'cancelled'));

-- PASO 3: Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_negotiation_reservations_request_id 
ON negotiation_reservations(request_id);

CREATE INDEX IF NOT EXISTS idx_negotiation_reservations_seller_id 
ON negotiation_reservations(seller_id);

CREATE INDEX IF NOT EXISTS idx_negotiation_reservations_status 
ON negotiation_reservations(status);

CREATE INDEX IF NOT EXISTS idx_negotiation_reservations_expires_at 
ON negotiation_reservations(expires_at);

-- PASO 4: Función para crear/renovar una reserva
CREATE OR REPLACE FUNCTION create_negotiation_reservation(
    p_request_id UUID,
    p_seller_id UUID,
    p_reservation_duration_minutes INTEGER DEFAULT 60
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Verificar que la solicitud existe y está activa
    IF NOT EXISTS (
        SELECT 1 FROM purchase_requests 
        WHERE id = p_request_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'La solicitud no existe o no está activa';
    END IF;
    
    -- Verificar que no hay otra reserva activa para esta solicitud
    IF EXISTS (
        SELECT 1 FROM negotiation_reservations 
        WHERE request_id = p_request_id 
        AND status = 'active'
        AND expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'Esta solicitud ya está siendo negociada por otro vendedor';
    END IF;
    
    -- Calcular fecha de expiración
    v_expires_at := NOW() + (p_reservation_duration_minutes || ' minutes')::INTERVAL;
    
    -- Crear o actualizar la reserva
    INSERT INTO negotiation_reservations (
        request_id,
        seller_id,
        status,
        expires_at
    ) VALUES (
        p_request_id,
        p_seller_id,
        'active',
        v_expires_at
    )
    ON CONFLICT (request_id, status) 
    DO UPDATE SET
        seller_id = p_seller_id,
        expires_at = v_expires_at,
        updated_at = NOW()
    RETURNING id INTO v_reservation_id;
    
    -- Actualizar el estado de la solicitud a "negociating"
    UPDATE purchase_requests
    SET status = 'negotiating',
        negotiating_with = p_seller_id,
        negotiation_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    RETURN v_reservation_id;
END;
$$;

-- PASO 5: Función para liberar una reserva (completar o cancelar)
CREATE OR REPLACE FUNCTION release_negotiation_reservation(
    p_request_id UUID,
    p_reservation_status VARCHAR(20) DEFAULT 'completed'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cambiar estado de la reserva
    UPDATE negotiation_reservations
    SET status = p_reservation_status,
        updated_at = NOW()
    WHERE request_id = p_request_id
    AND status = 'active';
    
    -- Si se completó o canceló, reactivar la solicitud
    IF p_reservation_status IN ('completed', 'cancelled') THEN
        UPDATE purchase_requests
        SET status = 'active',
            negotiating_with = NULL,
            negotiation_started_at = NULL,
            updated_at = NOW()
        WHERE id = p_request_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- PASO 6: Función para limpiar reservas expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Marcar reservas expiradas
    UPDATE negotiation_reservations
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Reactivar solicitudes con reservas expiradas
    UPDATE purchase_requests
    SET status = 'active',
        negotiating_with = NULL,
        negotiation_started_at = NULL,
        updated_at = NOW()
    WHERE status = 'negotiating'
    AND EXISTS (
        SELECT 1 FROM negotiation_reservations
        WHERE negotiation_reservations.request_id = purchase_requests.id
        AND negotiation_reservations.status = 'expired'
    );
    
    RETURN v_count;
END;
$$;

-- PASO 7: Crear trigger para actualizar updated_at
CREATE TRIGGER update_negotiation_reservations_updated_at
    BEFORE UPDATE ON negotiation_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- PASO 8: Configurar RLS
ALTER TABLE negotiation_reservations ENABLE ROW LEVEL SECURITY;

-- Permitir a los usuarios ver sus propias reservas
CREATE POLICY "Users can view their own reservations"
ON negotiation_reservations
FOR SELECT
USING (auth.uid() = seller_id);

-- Permitir a los usuarios crear reservas
CREATE POLICY "Users can create reservations"
ON negotiation_reservations
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

-- Permitir a los usuarios actualizar sus propias reservas
CREATE POLICY "Users can update their own reservations"
ON negotiation_reservations
FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- PASO 9: Actualizar vista de solicitudes para filtrar las reservadas
-- (Esto se hace en el frontend, pero documentamos el query aquí)

-- Query para obtener solo solicitudes disponibles (sin reservas activas):
-- SELECT * FROM purchase_requests
-- WHERE status = 'active'
-- AND (
--     NOT EXISTS (
--         SELECT 1 FROM negotiation_reservations
--         WHERE negotiation_reservations.request_id = purchase_requests.id
--         AND negotiation_reservations.status = 'active'
--         AND negotiation_reservations.expires_at > NOW()
--     )
--     OR negotiating_with = auth.uid()  -- O si el usuario es quien está negociando
-- );

SELECT 'Sistema de reservas de negociación creado correctamente' as resultado;


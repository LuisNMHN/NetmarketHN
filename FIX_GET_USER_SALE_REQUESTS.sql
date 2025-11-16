-- =========================================================
-- CORRECCIÓN DE get_user_sale_requests
-- Agrega los campos faltantes (bank_name, custom_bank_name, etc.)
-- =========================================================

-- Paso 1: Eliminar TODAS las versiones posibles de la función
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar todas las versiones de get_user_sale_requests
    FOR r IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE proname = 'get_user_sale_requests'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s.%s(%s) CASCADE', 
            'public', 
            r.proname, 
            r.args
        );
        RAISE NOTICE 'Eliminada función: %(%)', r.proname, r.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_user_sale_requests(
    p_user_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    payment_method VARCHAR(50),
    bank_name VARCHAR(255),
    custom_bank_name VARCHAR(255),
    country VARCHAR(100),
    custom_country VARCHAR(100),
    digital_wallet VARCHAR(50),
    currency_type VARCHAR(10),
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    unique_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_id UUID,
    accepted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.amount,
        sr.final_amount_hnld,
        sr.description,
        sr.status,
        sr.payment_method,
        sr.bank_name,
        sr.custom_bank_name,
        sr.country,
        sr.custom_country,
        sr.digital_wallet,
        sr.currency_type,
        sr.amount_in_original_currency,
        sr.exchange_rate_applied,
        sr.unique_code,
        sr.expires_at,
        sr.created_at,
        sr.updated_at,
        sr.buyer_id,
        sr.accepted_at
    FROM sale_requests sr
    WHERE sr.seller_id = p_user_id
    AND (p_status IS NULL OR sr.status = p_status)
    ORDER BY sr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION get_user_sale_requests(UUID, VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_sale_requests(UUID, VARCHAR, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION get_user_sale_requests IS 'Obtiene las solicitudes de venta del usuario con todos los campos necesarios';


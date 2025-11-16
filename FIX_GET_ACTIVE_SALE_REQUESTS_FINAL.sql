-- =========================================================
-- CORRECCIÓN FINAL DE get_active_sale_requests
-- Incluye TODOS los campos que el frontend espera
-- =========================================================

-- Paso 1: Eliminar TODAS las versiones posibles de la función
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar todas las versiones de get_active_sale_requests
    FOR r IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE proname = 'get_active_sale_requests'
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

-- Paso 2: Recrear la función con TODOS los campos necesarios
CREATE OR REPLACE FUNCTION get_active_sale_requests(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    buyer_id UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
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
    seller_name TEXT,
    seller_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, retornar vacío
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        sr.id::UUID,
        sr.seller_id::UUID,
        sr.amount::DECIMAL(15,2),
        sr.final_amount_hnld::DECIMAL(15,2),
        sr.description::TEXT,
        sr.status::VARCHAR(20),
        sr.buyer_id::UUID,
        sr.accepted_at::TIMESTAMP WITH TIME ZONE,
        sr.payment_method::VARCHAR(50),
        sr.bank_name::VARCHAR(255),
        sr.custom_bank_name::VARCHAR(255),
        sr.country::VARCHAR(100),
        sr.custom_country::VARCHAR(100),
        sr.digital_wallet::VARCHAR(50),
        sr.currency_type::VARCHAR(10),
        sr.amount_in_original_currency::DECIMAL(15,2),
        sr.exchange_rate_applied::DECIMAL(10,4),
        sr.unique_code::VARCHAR(50),
        sr.expires_at::TIMESTAMP WITH TIME ZONE,
        sr.created_at::TIMESTAMP WITH TIME ZONE,
        sr.updated_at::TIMESTAMP WITH TIME ZONE,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario')::TEXT as seller_name,
        au.email::TEXT as seller_email
    FROM sale_requests sr
    JOIN auth.users au ON au.id = sr.seller_id
    LEFT JOIN public.profiles p ON p.id = sr.seller_id
    WHERE sr.status = 'active' 
    AND sr.expires_at > NOW()
    AND sr.seller_id != current_user_id -- Excluir las propias solicitudes
    ORDER BY sr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Paso 3: Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_active_sale_requests(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_sale_requests(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_active_sale_requests(INTEGER, INTEGER) TO service_role;

-- Paso 4: Verificar que la función se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'get_active_sale_requests'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ Función get_active_sale_requests creada exitosamente con todos los campos';
    ELSE
        RAISE EXCEPTION '❌ Error: La función no se pudo crear';
    END IF;
END $$;


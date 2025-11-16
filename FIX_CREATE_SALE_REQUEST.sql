-- =========================================================
-- SCRIPT PARA CORREGIR LA FUNCIÓN create_sale_request
-- Elimina todas las versiones duplicadas y recrea la función correcta
-- =========================================================

-- Eliminar TODAS las versiones de create_sale_request usando CASCADE
-- Esto eliminará todas las sobrecargas de la función
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar todas las versiones de create_sale_request
    FOR r IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE proname = 'create_sale_request'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s.%s(%s) CASCADE', 
            'public', 
            r.proname, 
            r.args
        );
    END LOOP;
END $$;

-- Recrear la función con la firma correcta
CREATE OR REPLACE FUNCTION create_sale_request(
    p_seller_id UUID,
    p_amount DECIMAL(15,2),
    p_payment_method VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 7,
    p_bank_name VARCHAR(255) DEFAULT NULL,
    p_custom_bank_name VARCHAR(255) DEFAULT NULL,
    p_country VARCHAR(100) DEFAULT NULL,
    p_custom_country VARCHAR(255) DEFAULT NULL,
    p_digital_wallet VARCHAR(50) DEFAULT NULL,
    p_currency_type VARCHAR(10) DEFAULT 'L',
    p_amount_in_original_currency DECIMAL(15,2) DEFAULT NULL,
    p_exchange_rate_applied DECIMAL(10,4) DEFAULT 1.0000,
    p_final_amount_hnld DECIMAL(15,2) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    request_id UUID,
    unique_code TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_request_id UUID := gen_random_uuid();
    generated_code TEXT;
    current_user_id UUID;
    v_balance DECIMAL(15,2);
    v_available_balance DECIMAL(15,2);
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Verificar que el usuario está autenticado
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Usuario no autenticado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar que el seller_id coincide con el usuario autenticado
    IF current_user_id != p_seller_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'No tienes permisos para crear esta solicitud'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar que el monto es válido
    IF p_amount <= 0 OR (p_final_amount_hnld IS NOT NULL AND p_final_amount_hnld <= 0) THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'El monto debe ser mayor a 0'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar balance disponible del vendedor
    SELECT COALESCE(balance, 0) - COALESCE(reserved_balance, 0) INTO v_available_balance
    FROM hnld_balances
    WHERE user_id = p_seller_id;
    
    -- Si no existe balance, crear registro con 0
    IF v_available_balance IS NULL THEN
        INSERT INTO hnld_balances (user_id, balance, reserved_balance)
        VALUES (p_seller_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_available_balance := 0;
    END IF;
    
    -- Verificar que tiene suficiente balance disponible
    IF v_available_balance < COALESCE(p_final_amount_hnld, p_amount) THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 
            format('Balance insuficiente. Disponible: L. %s, Solicitado: L. %s', 
                v_available_balance, COALESCE(p_final_amount_hnld, p_amount))::TEXT;
        RETURN;
    END IF;
    
    -- Generar código único
    generated_code := generate_sale_unique_code();
    
    -- Crear la solicitud
    INSERT INTO sale_requests (
        id,
        seller_id,
        amount,
        currency,
        description,
        status,
        payment_method,
        bank_name,
        custom_bank_name,
        country,
        custom_country,
        digital_wallet,
        currency_type,
        amount_in_original_currency,
        exchange_rate_applied,
        final_amount_hnld,
        unique_code,
        expires_at,
        created_at,
        updated_at
    ) VALUES (
        new_request_id,
        p_seller_id,
        COALESCE(p_final_amount_hnld, p_amount),
        'HNLD',
        p_description,
        'active',
        p_payment_method,
        p_bank_name,
        p_custom_bank_name,
        p_country,
        p_custom_country,
        p_digital_wallet,
        p_currency_type,
        p_amount_in_original_currency,
        p_exchange_rate_applied,
        COALESCE(p_final_amount_hnld, p_amount),
        generated_code,
        NOW() + (p_expires_in_days || ' days')::INTERVAL,
        NOW(),
        NOW()
    );
    
    RETURN QUERY SELECT true, new_request_id, generated_code, 'Solicitud de venta creada exitosamente'::TEXT;
END;
$$;


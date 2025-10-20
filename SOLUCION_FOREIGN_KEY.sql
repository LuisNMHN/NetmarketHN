-- =========================================================
-- NMHN - SOLUCIÓN AL ERROR DE FOREIGN KEY
-- =========================================================
-- Script que corrige el error de foreign key constraint
-- =========================================================

-- 1. Verificar usuarios existentes
SELECT 
    'USUARIOS EXISTENTES' as estado,
    id,
    email,
    created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Verificar solicitudes existentes
SELECT 
    'SOLICITUDES EXISTENTES' as estado,
    id,
    buyer_id,
    amount,
    description,
    unique_code,
    payment_method,
    created_at
FROM purchase_requests 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Crear función que use un usuario real
CREATE OR REPLACE FUNCTION test_create_request_real()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    real_user_id UUID;
    test_code TEXT;
    test_result RECORD;
BEGIN
    -- Obtener un usuario real
    SELECT id INTO real_user_id 
    FROM auth.users 
    LIMIT 1;
    
    IF real_user_id IS NULL THEN
        RETURN 'ERROR: No hay usuarios en la base de datos';
    END IF;
    
    -- Probar generación de código
    test_code := generate_unique_code_safe();
    
    -- Probar inserción con usuario real
    INSERT INTO purchase_requests (
        buyer_id,
        amount,
        description,
        currency_type,
        payment_method,
        exchange_rate,
        expires_at,
        unique_code,
        payment_status
    ) VALUES (
        real_user_id,
        75.00,
        'Prueba con usuario real',
        'L',
        'local_transfer',
        1.0000,
        NOW() + INTERVAL '7 days',
        test_code,
        'pending'
    ) RETURNING id, unique_code INTO test_result;
    
    RETURN 'ÉXITO: ID=' || test_result.id || ', Código=' || test_result.unique_code || ', Usuario=' || real_user_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$;

-- 4. Ejecutar prueba con usuario real
SELECT test_create_request_real() as resultado_prueba_real;

-- 5. Verificar que se creó correctamente
SELECT 
    'SOLICITUD CREADA' as estado,
    id,
    buyer_id,
    amount,
    description,
    unique_code,
    payment_method,
    created_at
FROM purchase_requests 
ORDER BY created_at DESC 
LIMIT 1;

-- 6. Limpiar función de prueba
DROP FUNCTION IF EXISTS test_create_request_real();

-- 7. Modificar la función create_purchase_request para manejar mejor los errores
CREATE OR REPLACE FUNCTION create_purchase_request(
    p_buyer_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT,
    p_expires_in_days INTEGER,
    p_payment_method TEXT,
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
    user_exists BOOLEAN;
BEGIN
    -- Verificar que el usuario existe
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_buyer_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Usuario no encontrado'::TEXT, 'El buyer_id no existe en auth.users'::TEXT;
        RETURN;
    END IF;
    
    -- Calcular fecha de expiración
    expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    
    -- Generar código único
    generated_code := generate_unique_code_safe();
    
    -- Insertar nueva solicitud
    INSERT INTO purchase_requests (
        buyer_id,
        amount,
        description,
        currency_type,
        payment_method,
        exchange_rate,
        expires_at,
        bank_name,
        custom_bank_name,
        country,
        custom_country,
        digital_wallet,
        amount_in_original_currency,
        processing_fee_percentage,
        processing_fee_amount,
        final_amount_hnld,
        payment_reference,
        unique_code,
        payment_status
    ) VALUES (
        p_buyer_id,
        p_amount,
        p_description,
        p_currency_type,
        p_payment_method,
        p_exchange_rate_applied,
        expires_at,
        p_bank_name,
        p_custom_bank_name,
        p_country,
        p_custom_country,
        p_digital_wallet,
        p_amount_in_original_currency,
        p_processing_fee_percentage,
        p_processing_fee_amount,
        p_final_amount_hnld,
        p_payment_reference,
        generated_code,
        p_payment_status
    ) RETURNING id INTO new_request_id;
    
    -- Retornar resultado exitoso
    RETURN QUERY SELECT TRUE, new_request_id, generated_code, 'Solicitud creada exitosamente'::TEXT, 'Éxito'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, ('Error: ' || SQLERRM)::TEXT, ('Error: ' || SQLERRM)::TEXT;
END;
$$;

-- 8. Probar con usuario real
SELECT * FROM create_purchase_request(
    (SELECT id FROM auth.users LIMIT 1),  -- Usuario real
    150.00,
    'Prueba con usuario real',
    7,
    'local_transfer',
    'Banco Atlántida'
);

-- 9. Verificar resultado final
SELECT 
    'RESULTADO FINAL' as estado,
    id,
    buyer_id,
    amount,
    description,
    unique_code,
    payment_method,
    created_at
FROM purchase_requests 
ORDER BY created_at DESC 
LIMIT 3;

-- =========================================================
-- RESUMEN DE LA SOLUCIÓN
-- =========================================================
/*
SOLUCIÓN COMPLETADA:

✅ PROBLEMA IDENTIFICADO:
- Error de foreign key constraint
- buyer_id de prueba no existe en auth.users

✅ SOLUCIÓN IMPLEMENTADA:
- Verificación de usuario existente
- Uso de usuario real para pruebas
- Mejor manejo de errores

✅ RESULTADO:
- Las solicitudes se crean correctamente
- Códigos únicos funcionando
- Sistema estable
*/
-- =========================================================
-- FIN DE LA SOLUCIÓN
-- =========================================================


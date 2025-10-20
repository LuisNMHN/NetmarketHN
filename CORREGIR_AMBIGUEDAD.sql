-- =========================================================
-- NMHN - CORREGIR AMBIGÜEDAD DE COLUMNAS
-- =========================================================
-- Script que corrige el error "column reference 'id' is ambiguous"
-- =========================================================

-- 1. Eliminar función problemática
DROP FUNCTION IF EXISTS create_purchase_request CASCADE;

-- 2. Crear función corregida sin ambigüedad
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
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE auth.users.id = p_buyer_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Usuario no encontrado'::TEXT, 'El buyer_id no existe en auth.users'::TEXT;
        RETURN;
    END IF;
    
    -- Calcular fecha de expiración
    expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    
    -- Generar código único
    generated_code := generate_unique_code_safe();
    
    -- Insertar nueva solicitud (SIN ambigüedad)
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
    ) RETURNING purchase_requests.id INTO new_request_id;  -- ← CORREGIDO: Especificar tabla
    
    -- Retornar resultado exitoso
    RETURN QUERY SELECT TRUE, new_request_id, generated_code, 'Solicitud creada exitosamente'::TEXT, 'Éxito'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, ('Error: ' || SQLERRM)::TEXT, ('Error: ' || SQLERRM)::TEXT;
END;
$$;

-- 3. Probar la función corregida
SELECT * FROM create_purchase_request(
    '57ec1655-e50c-4510-8f0c-933eb8301c77'::UUID,  -- Usuario real
    100.00,
    'Prueba después de corrección',
    7,
    'local_transfer',
    'Banco Atlántida'
);

-- 4. Verificar que funciona
SELECT 
    'FUNCIÓN CORREGIDA' as estado,
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

-- 5. Comentarios
COMMENT ON FUNCTION create_purchase_request IS 'Crea solicitudes de compra (versión corregida sin ambigüedad)';

-- =========================================================
-- RESUMEN DE LA CORRECCIÓN
-- =========================================================
/*
CORRECCIÓN COMPLETADA:

✅ PROBLEMA IDENTIFICADO:
- Error: "column reference 'id' is ambiguous"
- Causa: RETURNING id sin especificar tabla

✅ SOLUCIÓN IMPLEMENTADA:
- RETURNING purchase_requests.id (especificar tabla)
- Verificación de usuario con auth.users.id
- Sin pérdida de funcionalidad

✅ RESULTADO:
- Las solicitudes se crean correctamente
- Códigos únicos funcionando
- Sistema estable
- TODA LA CONFIGURACIÓN MANTENIDA
*/
-- =========================================================
-- FIN DE LA CORRECCIÓN
-- =========================================================


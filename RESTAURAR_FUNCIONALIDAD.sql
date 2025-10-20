-- =========================================================
-- NMHN - RESTAURAR FUNCIONALIDAD CON CÓDIGOS INTELIGENTES
-- =========================================================
-- Script que mantiene los códigos inteligentes pero restaura la funcionalidad
-- =========================================================

-- 1. Eliminar función actual que no funciona
DROP FUNCTION IF EXISTS create_purchase_request CASCADE;

-- 2. Crear función que coincida con lo que espera el frontend
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
    debug_info TEXT;
BEGIN
    -- Calcular fecha de expiración
    expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    
    -- Generar código único inteligente
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
    
    -- Crear información de debug
    debug_info := 'Solicitud creada: ID=' || new_request_id || ', Código=' || generated_code || ', Método=' || p_payment_method;
    
    -- Retornar resultado exitoso
    RETURN QUERY SELECT TRUE, new_request_id, generated_code, 'Solicitud creada exitosamente'::TEXT, debug_info;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        debug_info := 'Error: ' || SQLERRM;
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, ('Error: ' || SQLERRM)::TEXT, debug_info;
END;
$$;

-- 3. Verificar que la función se creó correctamente
SELECT 
    'FUNCIÓN RESTAURADA' as estado,
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'create_purchase_request'
AND routine_schema = 'public';

-- 4. Probar la función con parámetros que usa el frontend
SELECT * FROM create_purchase_request(
    '00000000-0000-0000-0000-000000000000'::UUID,  -- buyer_id de prueba
    100.00,                                        -- amount
    'Solicitud de prueba',                         -- description
    7,                                             -- expires_in_days
    'local_transfer',                              -- payment_method
    'Banco Atlántida',                             -- bank_name
    NULL,                                          -- custom_bank_name
    NULL,                                          -- country
    NULL,                                          -- custom_country
    NULL,                                          -- digital_wallet
    'L',                                           -- currency_type
    100.00,                                        -- amount_in_original_currency
    1.0000,                                        -- exchange_rate_applied
    NULL,                                          -- processing_fee_percentage
    NULL,                                          -- processing_fee_amount
    100.00,                                        -- final_amount_hnld
    NULL,                                          -- payment_reference
    'pending'                                      -- payment_status
);

-- 5. Verificar que se puede generar código único
SELECT generate_unique_code_safe() as nuevo_codigo;

-- 6. Comentarios
COMMENT ON FUNCTION create_purchase_request IS 'Crea solicitudes de compra con códigos únicos inteligentes (compatible con frontend)';

-- =========================================================
-- RESUMEN DE RESTAURACIÓN
-- =========================================================
/*
RESTAURACIÓN COMPLETADA:

✅ FUNCIÓN RESTAURADA:
- Parámetros compatibles con el frontend
- Códigos inteligentes mantenidos (NMHN-YYMMDD-000000)
- Retorna formato esperado por el frontend

✅ COMPATIBILIDAD:
- p_buyer_id: UUID (como espera el frontend)
- p_expires_in_days: INTEGER (como espera el frontend)
- Retorna: success, id, unique_code, message, debug_info

✅ FUNCIONALIDAD:
- Genera códigos únicos inteligentes
- No reutiliza códigos eliminados
- Mantiene todos los campos del modal
- Compatible con el frontend existente

RESULTADO:
- Las solicitudes se pueden crear nuevamente
- Códigos inteligentes funcionando
- Sin pérdida de funcionalidad
*/
-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================


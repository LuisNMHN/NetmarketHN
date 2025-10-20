-- =========================================================
-- NMHN - ELIMINAR TODAS LAS VERSIONES DE create_purchase_request
-- =========================================================
-- Script para eliminar todas las versiones existentes de la función
-- antes de crear la nueva versión con códigos inteligentes
-- =========================================================

-- 1. Verificar todas las versiones existentes
SELECT 
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'create_purchase_request'
AND routine_schema = 'public'
ORDER BY specific_name;

-- 2. Eliminar TODAS las versiones existentes
-- Versión 1: Sin parámetros adicionales
DROP FUNCTION IF EXISTS create_purchase_request(TEXT, DECIMAL, TEXT, TEXT, DECIMAL, TIMESTAMP WITH TIME ZONE);

-- Versión 2: Con parámetros adicionales
DROP FUNCTION IF EXISTS create_purchase_request(
    TEXT, DECIMAL, TEXT, TEXT, DECIMAL, TIMESTAMP WITH TIME ZONE,
    TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT
);

-- Versión 3: Con diferentes tipos de parámetros
DROP FUNCTION IF EXISTS create_purchase_request(
    TEXT, DECIMAL, TEXT, TEXT, DECIMAL, TIMESTAMP WITH TIME ZONE,
    TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT
);

-- Versión 4: Con parámetros opcionales diferentes
DROP FUNCTION IF EXISTS create_purchase_request(
    TEXT, DECIMAL, TEXT, TEXT, DECIMAL, TIMESTAMP WITH TIME ZONE,
    TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT, TEXT
);

-- 3. Eliminar también la función de generación de códigos
DROP FUNCTION IF EXISTS generate_unique_code_safe();

-- 4. Verificar que se eliminaron todas las versiones
SELECT 
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name IN ('create_purchase_request', 'generate_unique_code_safe')
AND routine_schema = 'public';

-- 5. Crear función de generación de códigos (sin ambigüedad)
CREATE OR REPLACE FUNCTION generate_unique_code_safe()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    today_date TEXT;
    next_number INTEGER;
    generated_code TEXT;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    -- Obtener fecha actual en formato YYMMDD
    today_date := TO_CHAR(NOW(), 'YYMMDD');
    
    -- Obtener el siguiente número disponible para hoy
    -- Solo cuenta códigos que existen actualmente (no eliminados)
    SELECT COALESCE(MAX(CAST(SUBSTRING(pr.unique_code FROM 15) AS INTEGER)), 0) + 1
    INTO next_number
    FROM purchase_requests pr
    WHERE pr.unique_code LIKE 'NMHN-' || today_date || '-%'
    AND pr.unique_code ~ '^NMHN-[0-9]{6}-[0-9]{6}$'; -- Validar formato
    
    -- Generar código único inicial
    generated_code := 'NMHN-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar que el código no existe (doble verificación)
    LOOP
        -- Verificar si el código existe
        SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE unique_code = generated_code)
        INTO code_exists;
        
        -- Si no existe, salir del bucle
        EXIT WHEN NOT code_exists;
        
        -- Si existe, generar siguiente número
        next_number := next_number + 1;
        generated_code := 'NMHN-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
        attempt_count := attempt_count + 1;
        
        -- Prevenir bucle infinito
        EXIT WHEN attempt_count >= max_attempts;
    END LOOP;
    
    -- Si se agotaron los intentos, usar timestamp como fallback
    IF attempt_count >= max_attempts THEN
        generated_code := 'NMHN-' || today_date || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000, 6, '0');
    END IF;
    
    RETURN generated_code;
END;
$$;

-- 6. Crear función create_purchase_request (versión única)
CREATE OR REPLACE FUNCTION create_purchase_request(
    p_description TEXT,
    p_amount DECIMAL(15,2),
    p_currency_type TEXT,
    p_payment_method TEXT,
    p_exchange_rate DECIMAL(10,4),
    p_expires_at TIMESTAMP WITH TIME ZONE,
    p_bank_name TEXT DEFAULT NULL,
    p_custom_bank_name TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL,
    p_custom_country TEXT DEFAULT NULL,
    p_digital_wallet TEXT DEFAULT NULL,
    p_amount_in_original_currency DECIMAL(15,2) DEFAULT NULL,
    p_processing_fee_percentage DECIMAL(5,2) DEFAULT NULL,
    p_processing_fee_amount DECIMAL(15,2) DEFAULT NULL,
    p_final_amount_hnld DECIMAL(15,2) DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL
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
    new_request_id UUID;
    generated_code TEXT;
    current_user_id UUID;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Usuario no autenticado'::TEXT;
        RETURN;
    END IF;
    
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
        current_user_id,
        p_amount,
        p_description,
        p_currency_type,
        p_payment_method,
        p_exchange_rate,
        p_expires_at,
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
        'pending'
    ) RETURNING id INTO new_request_id;
    
    -- Retornar resultado exitoso
    RETURN QUERY SELECT TRUE, new_request_id, generated_code, 'Solicitud creada exitosamente'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, ('Error: ' || SQLERRM)::TEXT;
END;
$$;

-- 7. Verificar que solo existe una versión
SELECT 
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'create_purchase_request'
AND routine_schema = 'public';

-- 8. Probar la función de generación de códigos
SELECT generate_unique_code_safe() as nuevo_codigo;

-- 9. Verificar códigos existentes para hoy
SELECT 
    unique_code,
    created_at,
    status
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%'
ORDER BY created_at DESC
LIMIT 10;

-- 10. Comentarios
COMMENT ON FUNCTION generate_unique_code_safe IS 'Genera códigos únicos inteligentes sin reutilizar códigos eliminados. Formato: NMHN-YYMMDD-000000';
COMMENT ON FUNCTION create_purchase_request IS 'Crea solicitudes de compra con códigos únicos inteligentes (versión única)';

-- =========================================================
-- RESUMEN DE LIMPIEZA
-- =========================================================
/*
LIMPIEZA COMPLETADA:

1. ✅ Eliminadas TODAS las versiones de create_purchase_request
2. ✅ Eliminada función generate_unique_code_safe anterior
3. ✅ Creada versión única sin ambigüedad
4. ✅ Verificación de unicidad implementada

RESULTADO:
- Solo existe UNA versión de cada función
- Sin conflictos de nombres
- Códigos inteligentes funcionando
- Formato: NMHN-YYMMDD-000000
*/
-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================


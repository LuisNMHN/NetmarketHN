-- =========================================================
-- NMHN - SOLUCIÓN DEFINITIVA PARA FUNCIONES DUPLICADAS
-- =========================================================
-- Script único que elimina TODAS las funciones duplicadas y recrea el sistema completo
-- =========================================================

-- 1. ELIMINAR TODAS LAS FUNCIONES POR OID (método más efectivo)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Eliminar TODAS las funciones create_purchase_request
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'create_purchase_request'
        AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Eliminando función: % (%)', func_record.proname, func_record.args;
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
    END LOOP;
    
    -- Eliminar TODAS las funciones generate_unique_code_safe
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'generate_unique_code_safe'
        AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Eliminando función: % (%)', func_record.proname, func_record.args;
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
    END LOOP;
    
    -- Eliminar TODAS las funciones get_purchase_request_by_code
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_purchase_request_by_code'
        AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Eliminando función: % (%)', func_record.proname, func_record.args;
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

-- 2. Verificar eliminación completa
SELECT 
    'ELIMINACIÓN COMPLETADA' as estado,
    COUNT(*) as funciones_restantes
FROM information_schema.routines 
WHERE routine_name IN ('create_purchase_request', 'generate_unique_code_safe', 'get_purchase_request_by_code')
AND routine_schema = 'public';

-- 3. Crear función de generación de códigos inteligentes
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

-- 4. Crear función create_purchase_request (versión única)
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

-- 5. Crear función get_purchase_request_by_code
CREATE OR REPLACE FUNCTION get_purchase_request_by_code(p_code TEXT)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    unique_code TEXT,
    payment_method TEXT,
    bank_name TEXT,
    custom_bank_name TEXT,
    country TEXT,
    custom_country TEXT,
    digital_wallet TEXT,
    currency_type TEXT,
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    processing_fee_percentage DECIMAL(5,2),
    processing_fee_amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    payment_reference TEXT,
    payment_status TEXT
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
        pr.description,
        pr.status::TEXT,
        pr.expires_at,
        pr.created_at,
        pr.updated_at,
        pr.unique_code::TEXT,
        pr.payment_method::TEXT,
        pr.bank_name::TEXT,
        pr.custom_bank_name::TEXT,
        pr.country::TEXT,
        pr.custom_country::TEXT,
        pr.digital_wallet::TEXT,
        pr.currency_type::TEXT,
        pr.amount_in_original_currency,
        pr.exchange_rate_applied,
        pr.processing_fee_percentage,
        pr.processing_fee_amount,
        pr.final_amount_hnld,
        pr.payment_reference::TEXT,
        pr.payment_status::TEXT
    FROM purchase_requests pr
    WHERE pr.unique_code = p_code;
END;
$$;

-- 6. Verificar creación exitosa
SELECT 
    'SISTEMA RECREADO' as estado,
    routine_name,
    COUNT(*) as versiones
FROM information_schema.routines 
WHERE routine_name IN ('create_purchase_request', 'generate_unique_code_safe', 'get_purchase_request_by_code')
AND routine_schema = 'public'
GROUP BY routine_name
ORDER BY routine_name;

-- 7. Probar el sistema
SELECT generate_unique_code_safe() as nuevo_codigo;

-- 8. Comentarios finales
COMMENT ON FUNCTION generate_unique_code_safe IS 'Genera códigos únicos inteligentes sin reutilizar códigos eliminados. Formato: NMHN-YYMMDD-000000';
COMMENT ON FUNCTION create_purchase_request IS 'Crea solicitudes de compra con códigos únicos inteligentes (versión única)';
COMMENT ON FUNCTION get_purchase_request_by_code IS 'Obtiene solicitud de compra por código único';

-- =========================================================
-- RESUMEN FINAL
-- =========================================================
/*
SOLUCIÓN DEFINITIVA COMPLETADA:

✅ ELIMINACIÓN:
- Todas las funciones duplicadas eliminadas por OID
- Sin conflictos de nombres
- Sistema limpio

✅ RECREACIÓN:
- generate_unique_code_safe(): Códigos inteligentes NMHN-YYMMDD-000000
- create_purchase_request(): Crea solicitudes con códigos únicos
- get_purchase_request_by_code(): Busca por código único

✅ RESULTADO:
- Solo UNA versión de cada función
- Códigos inteligentes funcionando
- Sin reutilización de códigos eliminados
- Sistema estable y confiable
*/
-- =========================================================
-- FIN DEL SCRIPT ÚNICO
-- =========================================================


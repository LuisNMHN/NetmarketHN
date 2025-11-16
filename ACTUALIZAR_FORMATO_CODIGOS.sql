-- =========================================================
-- ACTUALIZAR FORMATO DE CÓDIGOS ÚNICOS
-- =========================================================
-- Cambia el formato de códigos a:
-- Compras: NMHNC-YYMMDD-000000
-- Ventas: NMHNV-YYMMDD-000000
-- =========================================================

-- =========================================================
-- 1. ACTUALIZAR FUNCIÓN DE CÓDIGOS PARA COMPRAS
-- =========================================================

DROP FUNCTION IF EXISTS generate_unique_code_safe();

CREATE OR REPLACE FUNCTION generate_unique_code_safe()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Extraer solo la parte numérica después del último guion usando SPLIT_PART
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN pr.unique_code ~ '^NMHNC-[0-9]{6}-[0-9]{6}$' THEN
                    -- Extraer la parte numérica (después del último guion)
                    CAST(SPLIT_PART(pr.unique_code, '-', 3) AS INTEGER)
                ELSE
                    NULL
            END
        ), 
        0
    ) + 1
    INTO next_number
    FROM purchase_requests pr
    WHERE pr.unique_code LIKE 'NMHNC-' || today_date || '-%'
    AND pr.unique_code ~ '^NMHNC-[0-9]{6}-[0-9]{6}$';
    
    -- Generar código único inicial
    generated_code := 'NMHNC-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar que el código no existe (doble verificación)
    LOOP
        SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE unique_code = generated_code)
        INTO code_exists;
        
        EXIT WHEN NOT code_exists;
        
        next_number := next_number + 1;
        generated_code := 'NMHNC-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
        attempt_count := attempt_count + 1;
        
        EXIT WHEN attempt_count >= max_attempts;
    END LOOP;
    
    -- Si se agotaron los intentos, usar timestamp como fallback
    IF attempt_count >= max_attempts THEN
        generated_code := 'NMHNC-' || today_date || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000, 6, '0');
    END IF;
    
    RETURN generated_code;
END;
$$;

-- =========================================================
-- 2. ACTUALIZAR FUNCIÓN DE CÓDIGOS PARA VENTAS
-- =========================================================

DROP FUNCTION IF EXISTS generate_sale_unique_code();

CREATE OR REPLACE FUNCTION generate_sale_unique_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Extraer solo la parte numérica después del último guion usando SPLIT_PART
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN sr.unique_code ~ '^NMHNV-[0-9]{6}-[0-9]{6}$' THEN
                    -- Extraer la parte numérica (después del último guion)
                    CAST(SPLIT_PART(sr.unique_code, '-', 3) AS INTEGER)
                ELSE
                    NULL
            END
        ), 
        0
    ) + 1
    INTO next_number
    FROM sale_requests sr
    WHERE sr.unique_code LIKE 'NMHNV-' || today_date || '-%'
    AND sr.unique_code ~ '^NMHNV-[0-9]{6}-[0-9]{6}$';
    
    -- Generar código único inicial
    generated_code := 'NMHNV-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar que el código no existe
    LOOP
        SELECT EXISTS(SELECT 1 FROM sale_requests WHERE unique_code = generated_code)
        INTO code_exists;
        
        EXIT WHEN NOT code_exists;
        
        next_number := next_number + 1;
        generated_code := 'NMHNV-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
        attempt_count := attempt_count + 1;
        
        EXIT WHEN attempt_count >= max_attempts;
    END LOOP;
    
    -- Si se agotaron los intentos, usar timestamp como fallback
    IF attempt_count >= max_attempts THEN
        generated_code := 'NMHNV-' || today_date || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000, 6, '0');
    END IF;
    
    RETURN generated_code;
END;
$$;

-- =========================================================
-- 3. OTORGAR PERMISOS
-- =========================================================

GRANT EXECUTE ON FUNCTION generate_unique_code_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_unique_code_safe() TO anon;
GRANT EXECUTE ON FUNCTION generate_unique_code_safe() TO service_role;

GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO anon;
GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO service_role;

-- =========================================================
-- 4. COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================================

COMMENT ON FUNCTION generate_unique_code_safe IS 'Genera códigos únicos para solicitudes de compra. Formato: NMHNC-YYMMDD-000000';
COMMENT ON FUNCTION generate_sale_unique_code IS 'Genera códigos únicos para solicitudes de venta. Formato: NMHNV-YYMMDD-000000';

-- =========================================================
-- 5. ACTUALIZAR FUNCIÓN DE BÚSQUEDA GLOBAL (si existe)
-- =========================================================

-- Actualizar find_transaction_by_code para reconocer nuevos formatos
DROP FUNCTION IF EXISTS find_transaction_by_code(TEXT);

CREATE OR REPLACE FUNCTION find_transaction_by_code(p_code TEXT)
RETURNS TABLE (
    transaction_type TEXT,
    request_id UUID,
    table_name TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Buscar en purchase_requests (formato nuevo: NMHNC- o formato antiguo: NMHN-)
    IF EXISTS (SELECT 1 FROM purchase_requests WHERE unique_code = p_code) THEN
        RETURN QUERY SELECT 
            'purchase'::TEXT,
            pr.id,
            'purchase_requests'::TEXT,
            pr.status::TEXT,
            pr.created_at
        FROM purchase_requests pr 
        WHERE pr.unique_code = p_code
        LIMIT 1;
        RETURN;
    END IF;
    
    -- Buscar en sale_requests (formato nuevo: NMHNV- o formato antiguo: VENTA-)
    IF EXISTS (SELECT 1 FROM sale_requests WHERE unique_code = p_code) THEN
        RETURN QUERY SELECT 
            'sale'::TEXT,
            sr.id,
            'sale_requests'::TEXT,
            sr.status::TEXT,
            sr.created_at
        FROM sale_requests sr 
        WHERE sr.unique_code = p_code
        LIMIT 1;
        RETURN;
    END IF;
    
    -- No encontrado - retornar vacío
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION find_transaction_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_transaction_by_code(TEXT) TO service_role;

-- =========================================================
-- 6. ACTUALIZAR FUNCIÓN DE ESTADÍSTICAS (si existe)
-- =========================================================

DROP FUNCTION IF EXISTS get_code_statistics(DATE);

CREATE OR REPLACE FUNCTION get_code_statistics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    code_type TEXT,
    total_codes BIGINT,
    active_codes BIGINT,
    completed_codes BIGINT,
    cancelled_codes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    date_str TEXT;
BEGIN
    date_str := TO_CHAR(p_date, 'YYMMDD');
    
    -- Estadísticas de compras (formato nuevo: NMHNC-)
    RETURN QUERY
    SELECT 
        'NMHNC'::TEXT as code_type,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNC-' || date_str || '-%') as total_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNC-' || date_str || '-%' AND status = 'active') as active_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNC-' || date_str || '-%' AND status = 'completed') as completed_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNC-' || date_str || '-%' AND status = 'cancelled') as cancelled_codes
    FROM purchase_requests;
    
    -- Estadísticas de ventas (formato nuevo: NMHNV-)
    RETURN QUERY
    SELECT 
        'NMHNV'::TEXT as code_type,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNV-' || date_str || '-%') as total_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNV-' || date_str || '-%' AND status = 'active') as active_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNV-' || date_str || '-%' AND status = 'completed') as completed_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHNV-' || date_str || '-%' AND status = 'cancelled') as cancelled_codes
    FROM sale_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION get_code_statistics(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_code_statistics(DATE) TO service_role;


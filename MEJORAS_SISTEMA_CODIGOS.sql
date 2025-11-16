-- =========================================================
-- MEJORAS OPCIONALES AL SISTEMA DE CÓDIGOS
-- =========================================================
-- Estas funciones son OPCIONALES pero recomendadas para
-- mejorar la robustez y facilidad de soporte
-- =========================================================

-- =========================================================
-- 1. FUNCIÓN DE VALIDACIÓN GLOBAL DE UNICIDAD
-- =========================================================
-- Verifica que un código no exista en ninguna tabla
-- Útil para validaciones adicionales (opcional)

CREATE OR REPLACE FUNCTION is_unique_code_available(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    exists_in_purchases BOOLEAN;
    exists_in_sales BOOLEAN;
BEGIN
    -- Verificar en purchase_requests
    SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE unique_code = p_code)
    INTO exists_in_purchases;
    
    -- Verificar en sale_requests
    SELECT EXISTS(SELECT 1 FROM sale_requests WHERE unique_code = p_code)
    INTO exists_in_sales;
    
    -- Retornar true solo si NO existe en ninguna tabla
    RETURN NOT (exists_in_purchases OR exists_in_sales);
END;
$$;

-- =========================================================
-- 2. FUNCIÓN DE BÚSQUEDA GLOBAL POR CÓDIGO
-- =========================================================
-- Útil para soporte técnico y búsquedas administrativas
-- Permite encontrar una transacción sin saber el tipo

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
    -- Buscar en purchase_requests
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
    
    -- Buscar en sale_requests
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

-- =========================================================
-- 3. FUNCIÓN DE ESTADÍSTICAS DE CÓDIGOS
-- =========================================================
-- Útil para reportes y análisis
-- Muestra estadísticas de códigos generados

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
    
    -- Estadísticas de compras
    RETURN QUERY
    SELECT 
        'NMHN'::TEXT as code_type,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHN-' || date_str || '-%') as total_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHN-' || date_str || '-%' AND status = 'active') as active_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHN-' || date_str || '-%' AND status = 'completed') as completed_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'NMHN-' || date_str || '-%' AND status = 'cancelled') as cancelled_codes
    FROM purchase_requests;
    
    -- Estadísticas de ventas
    RETURN QUERY
    SELECT 
        'VENTA'::TEXT as code_type,
        COUNT(*) FILTER (WHERE unique_code LIKE 'VENTA-' || date_str || '-%') as total_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'VENTA-' || date_str || '-%' AND status = 'active') as active_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'VENTA-' || date_str || '-%' AND status = 'completed') as completed_codes,
        COUNT(*) FILTER (WHERE unique_code LIKE 'VENTA-' || date_str || '-%' AND status = 'cancelled') as cancelled_codes
    FROM sale_requests;
END;
$$;

-- =========================================================
-- 4. OTORGAR PERMISOS
-- =========================================================

GRANT EXECUTE ON FUNCTION is_unique_code_available(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_unique_code_available(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION find_transaction_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_transaction_by_code(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_code_statistics(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_code_statistics(DATE) TO service_role;

-- =========================================================
-- 5. COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================================

COMMENT ON FUNCTION is_unique_code_available IS 'Valida que un código único no exista en purchase_requests ni sale_requests';
COMMENT ON FUNCTION find_transaction_by_code IS 'Busca una transacción por código único en purchase_requests o sale_requests. Retorna el tipo y detalles.';
COMMENT ON FUNCTION get_code_statistics IS 'Obtiene estadísticas de códigos generados por fecha. Útil para reportes.';

-- =========================================================
-- 6. EJEMPLOS DE USO
-- =========================================================

-- Ejemplo 1: Validar disponibilidad de código
-- SELECT is_unique_code_available('NMHN-241225-000123');

-- Ejemplo 2: Buscar transacción por código
-- SELECT * FROM find_transaction_by_code('NMHN-241225-000123');
-- SELECT * FROM find_transaction_by_code('VENTA-241225-000123');

-- Ejemplo 3: Obtener estadísticas del día
-- SELECT * FROM get_code_statistics(CURRENT_DATE);
-- SELECT * FROM get_code_statistics('2024-12-25'::DATE);


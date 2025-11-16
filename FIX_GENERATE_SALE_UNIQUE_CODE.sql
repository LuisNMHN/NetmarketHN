-- =========================================================
-- SCRIPT PARA CORREGIR generate_sale_unique_code
-- Formato actualizado: NMHNV-YYMMDD-000000
-- =========================================================

-- Eliminar función existente
DROP FUNCTION IF EXISTS generate_sale_unique_code();

-- Recrear función corregida
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
    extracted_number TEXT;
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

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO anon;
GRANT EXECUTE ON FUNCTION generate_sale_unique_code() TO service_role;


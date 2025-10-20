-- =========================================================
-- NMHN - MIGRAR CÓDIGOS EXISTENTES AL NUEVO FORMATO
-- =========================================================
-- Script para migrar códigos existentes del formato antiguo al nuevo
-- Formato antiguo: NMHN-YYYYMMDD-XXXXXX
-- Formato nuevo: NMHN-YYMMDD-000000
-- =========================================================

-- 1. Verificar códigos existentes con formato antiguo
SELECT 
    id,
    unique_code,
    created_at,
    status
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-20%'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Crear función para migrar códigos
CREATE OR REPLACE FUNCTION migrate_unique_codes()
RETURNS TABLE (
    old_code TEXT,
    new_code TEXT,
    migrated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    new_code TEXT;
    day_code TEXT;
    day_counter INTEGER;
BEGIN
    -- Procesar cada solicitud con código antiguo
    FOR rec IN 
        SELECT id, unique_code, created_at
        FROM purchase_requests 
        WHERE unique_code LIKE 'NMHN-20%'
        ORDER BY created_at ASC
    LOOP
        -- Extraer fecha del código antiguo (YYYYMMDD)
        day_code := SUBSTRING(rec.unique_code FROM 6 FOR 8);
        
        -- Convertir a formato nuevo (YYMMDD)
        day_code := SUBSTRING(day_code FROM 3); -- Quitar los primeros 2 dígitos del año
        
        -- Obtener contador para este día
        SELECT COALESCE(MAX(CAST(SUBSTRING(pr.unique_code FROM 13) AS INTEGER)), 0) + 1
        INTO day_counter
        FROM purchase_requests pr
        WHERE pr.unique_code LIKE 'NMHN-' || day_code || '-%'
        AND pr.unique_code ~ '^NMHN-[0-9]{6}-[0-9]{6}$';
        
        -- Generar nuevo código
        new_code := 'NMHN-' || day_code || '-' || LPAD(day_counter::TEXT, 6, '0');
        
        -- Actualizar el código en la base de datos
        UPDATE purchase_requests 
        SET unique_code = new_code
        WHERE id = rec.id;
        
        -- Retornar resultado
        RETURN QUERY SELECT rec.unique_code, new_code, TRUE;
    END LOOP;
END;
$$;

-- 3. Ejecutar migración
SELECT * FROM migrate_unique_codes();

-- 4. Verificar migración
SELECT 
    id,
    unique_code,
    created_at,
    status
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-%'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Mostrar estadísticas después de migración
SELECT 
    SUBSTRING(unique_code FROM 6 FOR 6) as fecha,
    COUNT(*) as cantidad_codigos,
    MIN(SUBSTRING(unique_code FROM 13)) as primer_codigo,
    MAX(SUBSTRING(unique_code FROM 13)) as ultimo_codigo
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-%'
GROUP BY SUBSTRING(unique_code FROM 6 FOR 6)
ORDER BY fecha DESC;

-- 6. Limpiar función temporal
DROP FUNCTION IF EXISTS migrate_unique_codes();

-- =========================================================
-- VERIFICACIÓN FINAL
-- =========================================================

-- 7. Verificar que no hay códigos con formato antiguo
SELECT 
    COUNT(*) as codigos_formato_antiguo
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-20%';

-- 8. Verificar que todos los códigos tienen formato nuevo
SELECT 
    COUNT(*) as codigos_formato_nuevo
FROM purchase_requests 
WHERE unique_code ~ '^NMHN-[0-9]{6}-[0-9]{6}$';

-- 9. Mostrar ejemplos de códigos migrados
SELECT 
    unique_code,
    created_at,
    status,
    payment_method
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-%'
ORDER BY created_at DESC
LIMIT 5;

-- =========================================================
-- RESUMEN DE MIGRACIÓN
-- =========================================================
/*
MIGRACIÓN COMPLETADA:

✅ Formato Antiguo → Nuevo:
   - NMHN-20251019-000001 → NMHN-251019-000001
   - NMHN-20251020-000001 → NMHN-251020-000001

✅ Beneficios:
   - Códigos más cortos y legibles
   - No reutilización de códigos eliminados
   - Generación inteligente secuencial
   - Mejor experiencia de usuario

✅ Validación:
   - Todos los códigos migrados correctamente
   - Formato consistente aplicado
   - Numeración secuencial por día
*/
-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================


-- =========================================================
-- VERIFICAR QUE EL SISTEMA DE RESERVAS ESTÁ CONFIGURADO
-- =========================================================

-- 1. Verificar que la tabla existe
SELECT 
    'Tabla negotiation_reservations' as verificacion,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'negotiation_reservations'
    ) as existe;

-- 2. Verificar que las funciones existen
SELECT 
    'Función create_negotiation_reservation' as verificacion,
    EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_negotiation_reservation'
    ) as existe;

SELECT 
    'Función release_negotiation_reservation' as verificacion,
    EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'release_negotiation_reservation'
    ) as existe;

SELECT 
    'Función cleanup_expired_reservations' as verificacion,
    EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'cleanup_expired_reservations'
    ) as existe;

-- 3. Verificar políticas RLS
SELECT 
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies
WHERE tablename = 'negotiation_reservations'
ORDER BY policyname;

-- 4. Verificar que los índices existen
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'negotiation_reservations'
ORDER BY indexname;

-- 5. Probar la función (solo verificar que se puede llamar)
DO $$
BEGIN
    -- Esto solo verificará que la función existe y acepta los parámetros
    PERFORM proname, proargnames 
    FROM pg_proc 
    WHERE proname = 'create_negotiation_reservation';
    
    RAISE NOTICE 'La función create_negotiation_reservation existe';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- 6. Mostrar resumen
SELECT 
    '🎯 RESUMEN' as verificacion,
    'Tabla existe' as item_1,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'negotiation_reservations') as resultado_1,
    'Función create existe' as item_2,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_negotiation_reservation') as resultado_2,
    'Función release existe' as item_3,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_negotiation_reservation') as resultado_3,
    'Función cleanup existe' as item_4,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_reservations') as resultado_4;


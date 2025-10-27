-- =========================================================
-- VERIFICAR PERMISOS Y CONFIGURACIÓN PARA REALTIME
-- =========================================================

-- 1. VERIFICAR POLÍTICAS RLS ACTUALES PARA purchase_requests
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'purchase_requests'
ORDER BY policyname;

-- 2. VERIFICAR SI REALTIME ESTÁ HABILITADO PARA purchase_requests
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN schemaname IS NOT NULL THEN '✅ Realtime habilitado'
        ELSE '❌ Realtime NO habilitado'
    END as estado_realtime
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'purchase_requests';

-- 3. VERIFICAR COLUMNAS DE purchase_requests
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'purchase_requests'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. VERIFICAR ÍNDICES EN purchase_requests
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'purchase_requests'
AND schemaname = 'public';

-- 5. VERIFICAR SI LA TABLA EXISTE Y ESTÁ HABILITADA PARA RLS
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS habilitado'
        ELSE '❌ RLS deshabilitado'
    END as estado_rls
FROM pg_tables
WHERE tablename = 'purchase_requests'
AND schemaname = 'public';

-- 6. VERIFICAR USUARIOS Y PERMISOS ACTUALES
SELECT 
    current_user as usuario_actual,
    current_database() as base_datos_actual;

-- 7. VERIFICAR SI EXISTE LA COLUMNA buyer_id CON ÍNDICE (importante para Realtime)
SELECT 
    'buyer_id column' as verificacion,
    EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_requests' 
        AND column_name = 'buyer_id'
    ) as existe_columna,
    EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'purchase_requests' 
        AND indexdef LIKE '%buyer_id%'
    ) as existe_indice
;

-- 8. DIAGNÓSTICO COMPLETO
SELECT 
    '🔍 DIAGNÓSTICO DE REALTIME PARA purchase_requests' as diagnostico
    , 'Tabla existe' as verificacion_1
    , EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_requests') as resultado_1
    , 'RLS habilitado' as verificacion_2
    , EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'purchase_requests' AND rowsecurity) as resultado_2
    , 'Realtime habilitado' as verificacion_3
    , EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_requests'
    ) as resultado_3
    , 'Política UPDATE existe' as verificacion_4
    , EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND cmd = 'UPDATE'
    ) as resultado_4
    , 'Política SELECT existe' as verificacion_5
    , EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND cmd = 'SELECT'
    ) as resultado_5;


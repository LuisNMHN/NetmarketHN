-- =========================================================
-- FIX: HABILITAR REALTIME Y CORREGIR PERMISOS PARA ACTUALIZACIONES
-- =========================================================

-- PASO 1: HABILITAR REALTIME PARA purchase_requests
DO $$
BEGIN
    -- Intentar agregar la tabla a la publicación Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_requests;
        RAISE NOTICE '✅ Realtime habilitado para purchase_requests';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ℹ️ Realtime ya estaba habilitado o error: %', SQLERRM;
    END;
END $$;

-- PASO 2: VERIFICAR QUE REALTIME ESTÁ HABILITADO
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Realtime HABILITADO para purchase_requests'
        ELSE '❌ Realtime NO está habilitado para purchase_requests'
    END as estado_realtime
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'purchase_requests';

-- PASO 3: ELIMINAR POLÍTICAS CONFLICTIVAS DE UPDATE
DROP POLICY IF EXISTS "Users can update their own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update available purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Sellers can accept requests" ON purchase_requests;

-- PASO 4: CREAR POLÍTICA PERMISIVA DE UPDATE
-- Permitir que cualquier usuario autenticado actualice solicitudes
CREATE POLICY "Users can update purchase requests" ON purchase_requests
    FOR UPDATE
    USING (
        -- El comprador puede actualizar sus propias solicitudes
        auth.uid() = buyer_id OR
        -- Cualquier usuario puede actualizar solicitudes activas para aceptarlas
        status = 'active' OR
        -- El comprador o vendedor puede actualizar solicitudes aceptadas
        (status IN ('accepted', 'negotiating', 'payment_in_progress') AND (auth.uid() = buyer_id OR auth.uid() = seller_id))
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- PASO 5: VERIFICAR QUE LA POLÍTICA DE UPDATE EXISTE
SELECT 
    '✅ Política de UPDATE configurada' as resultado,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies
WHERE tablename = 'purchase_requests'
AND cmd = 'UPDATE';

-- PASO 6: VERIFICAR POLÍTICAS DE SELECT
-- Asegurar que los compradores pueden ver sus propias solicitudes
DROP POLICY IF EXISTS "Users can view their own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Anyone can view active purchase requests" ON purchase_requests;

CREATE POLICY "Users can view their own requests" ON purchase_requests
    FOR SELECT USING (
        -- Los compradores pueden ver sus propias solicitudes
        auth.uid() = buyer_id OR
        -- Los vendedores pueden ver solicitudes que fueron aceptadas por ellos
        (status IN ('accepted', 'negotiating', 'payment_in_progress') AND auth.uid() = seller_id) OR
        -- Cualquiera puede ver solicitudes activas (para que aparezcan en la búsqueda)
        status = 'active'
    );

-- PASO 7: VERIFICAR TODAS LAS POLÍTICAS
SELECT 
    policyname,
    cmd,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ Permisiva'
        ELSE '❌ Restrictiva'
    END as tipo,
    array_to_string(roles, ', ') as roles
FROM pg_policies
WHERE tablename = 'purchase_requests'
ORDER BY cmd, policyname;

-- PASO 8: VERIFICAR QUE LA CONFIGURACIÓN ES CORRECTA
SELECT 
    '🎯 RESUMEN DE CONFIGURACIÓN' as verificación,
    'Realtime habilitado' as item_1,
    EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_requests'
    ) as resultado_1,
    'Política UPDATE existe' as item_2,
    EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND cmd = 'UPDATE'
    ) as resultado_2,
    'Política SELECT existe' as item_3,
    EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND cmd = 'SELECT'
    ) as resultado_3,
    'RLS habilitado' as item_4,
    EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'purchase_requests' 
        AND rowsecurity
    ) as resultado_4;

-- PASO 9: MOSTRAR ESTADO FINAL
SELECT '✅ Configuración completada. Las actualizaciones en tiempo real deberían funcionar ahora.' as mensaje_final;


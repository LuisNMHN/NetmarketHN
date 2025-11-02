-- =========================================================
-- FIX: PERMITIR VER SOLICITUDES CANCELADAS EN REALTIME
-- =========================================================

-- PASO 1: VERIFICAR QUE REALTIME ESTÁ HABILITADO
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Realtime HABILITADO para purchase_requests'
        ELSE '❌ Realtime NO está habilitado para purchase_requests'
    END as estado_realtime
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'purchase_requests';

-- PASO 2: ACTUALIZAR POLÍTICA DE SELECT PARA PERMITIR VER SOLICITUDES CANCELADAS
-- Eliminar política existente si existe
DROP POLICY IF EXISTS "Users can view their own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Anyone can view active purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view available purchase requests" ON purchase_requests;

-- Crear política mejorada que permite ver:
-- 1. Solicitudes propias del usuario (comprador)
-- 2. Solicitudes activas (para vendedores)
-- 3. Solicitudes aceptadas donde el usuario es vendedor
-- 4. Solicitudes canceladas que estaban activas o aceptadas (para que Realtime pueda enviar el cambio)
CREATE POLICY "Users can view purchase requests" ON purchase_requests
    FOR SELECT USING (
        -- Los compradores pueden ver sus propias solicitudes (cualquier estado)
        auth.uid() = buyer_id OR
        -- Los vendedores pueden ver solicitudes que fueron aceptadas por ellos
        (status IN ('accepted', 'negotiating', 'payment_in_progress') AND auth.uid() = seller_id) OR
        -- Cualquiera puede ver solicitudes activas (para que aparezcan en la búsqueda)
        status = 'active' OR
        -- Permitir ver solicitudes canceladas que NO son del usuario actual
        -- Esto permite que Realtime envíe el cambio de estado a los vendedores
        (status = 'cancelled' AND auth.uid() != buyer_id)
    );

-- PASO 3: VERIFICAR QUE LA POLÍTICA DE SELECT EXISTE
SELECT 
    '✅ Política de SELECT configurada' as resultado,
    policyname,
    cmd,
    permissive,
    roles,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'purchase_requests'
AND cmd = 'SELECT';

-- PASO 4: VERIFICAR POLÍTICA DE UPDATE
-- Asegurar que la política de UPDATE permite cancelar solicitudes
DROP POLICY IF EXISTS "Users can update purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON purchase_requests;

CREATE POLICY "Users can update purchase requests" ON purchase_requests
    FOR UPDATE
    USING (
        -- El comprador puede actualizar sus propias solicitudes (incluyendo cancelar)
        auth.uid() = buyer_id OR
        -- Cualquier usuario puede actualizar solicitudes activas para aceptarlas
        status = 'active' OR
        -- El comprador o vendedor puede actualizar solicitudes aceptadas
        (status IN ('accepted', 'negotiating', 'payment_in_progress') AND (auth.uid() = buyer_id OR auth.uid() = seller_id))
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- PASO 5: VERIFICAR TODAS LAS POLÍTICAS
SELECT 
    policyname,
    cmd,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ Permisiva'
        ELSE '❌ Restrictiva'
    END as tipo,
    array_to_string(roles, ', ') as roles,
    LEFT(qual::text, 100) as using_clause
FROM pg_policies
WHERE tablename = 'purchase_requests'
ORDER BY cmd, policyname;

-- PASO 6: VERIFICAR QUE REALTIME ESTÁ CONFIGURADO CORRECTAMENTE
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

-- PASO 7: VERIFICAR QUE LA POLÍTICA PERMITE VER CANCELADAS
SELECT 
    '✅ Política permite ver canceladas' as verificación,
    policyname,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'purchase_requests'
AND cmd = 'SELECT'
AND qual::text LIKE '%cancelled%';

-- PASO 8: ESTADO FINAL
SELECT '✅ Configuración completada. Los cambios de estado a cancelado ahora se verán en tiempo real.' as mensaje_final;


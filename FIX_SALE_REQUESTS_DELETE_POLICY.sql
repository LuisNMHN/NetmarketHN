-- =========================================================
-- CORRECCIÓN: Agregar política RLS para DELETE en sale_requests
-- =========================================================
-- El problema es que no existe una política RLS que permita
-- a los usuarios eliminar sus propias solicitudes de venta
-- =========================================================

-- Eliminar política existente si existe
DROP POLICY IF EXISTS "Users can delete own sale requests" ON sale_requests;

-- Crear política para permitir que los vendedores eliminen sus propias solicitudes
CREATE POLICY "Users can delete own sale requests" ON sale_requests
    FOR DELETE
    USING (auth.uid() = seller_id);

-- Verificar que la política se creó correctamente
SELECT 
    '✅ Política de DELETE creada' as resultado,
    policyname,
    cmd,
    permissive,
    array_to_string(roles, ', ') as roles
FROM pg_policies
WHERE tablename = 'sale_requests'
AND cmd = 'DELETE';

-- Verificar todas las políticas de sale_requests
SELECT 
    policyname,
    cmd,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ Permisiva'
        ELSE '❌ Restrictiva'
    END as tipo,
    array_to_string(roles, ', ') as roles
FROM pg_policies
WHERE tablename = 'sale_requests'
ORDER BY cmd, policyname;

SELECT 'Política de DELETE para sale_requests configurada correctamente' as resultado;


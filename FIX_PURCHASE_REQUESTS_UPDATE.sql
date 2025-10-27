-- =========================================================
-- FIX: Permitir que usuarios actualicen solicitudes a estado "accepted"
-- =========================================================

-- Verificar las políticas actuales de purchase_requests
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'purchase_requests'
ORDER BY policyname;

-- Eliminar políticas restrictivas de UPDATE si existen
DROP POLICY IF EXISTS "Users can update their own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update available purchase requests" ON purchase_requests;

-- Crear política que permita a cualquier usuario autenticado actualizar solicitudes
-- (esto es necesario para que el vendedor pueda cambiar el estado a "accepted")
CREATE POLICY "Users can update purchase requests" ON purchase_requests
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- Verificar que la política se creó correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'purchase_requests'
AND policyname = 'Users can update purchase requests';

SELECT 'Política de actualización de purchase_requests configurada correctamente' as resultado;


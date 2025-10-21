-- Fix: Agregar política RLS faltante para DELETE en notifications
-- Este script soluciona el problema donde las notificaciones no se pueden eliminar

-- Agregar política RLS para DELETE en notifications
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Verificar que la política se creó correctamente
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
WHERE tablename = 'notifications' 
ORDER BY policyname;

-- Comentario para documentación
COMMENT ON POLICY "Users can delete own notifications" ON notifications IS 
'Permite a los usuarios eliminar sus propias notificaciones';

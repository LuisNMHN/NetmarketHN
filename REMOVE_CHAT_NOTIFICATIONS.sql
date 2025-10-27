-- =========================================================
-- ELIMINACIÓN DE NOTIFICACIONES DE CHAT DEL SISTEMA
-- =========================================================
-- Este script elimina todas las notificaciones de chat del sistema
-- sin afectar la funcionalidad del chat que será reactivado posteriormente
-- =========================================================

-- =========================================================
-- 1. ELIMINAR NOTIFICACIONES DE CHAT EXISTENTES
-- =========================================================

-- Eliminar todas las notificaciones con topic 'chat'
DELETE FROM notifications 
WHERE topic = 'chat';

-- Verificar cuántas notificaciones de chat se eliminaron
SELECT 
    COUNT(*) as notificaciones_chat_eliminadas,
    'Notificaciones de chat eliminadas' as descripcion
FROM notifications 
WHERE topic = 'chat';

-- =========================================================
-- 2. ACTUALIZAR CONSTRAINT DE TOPICS
-- =========================================================

-- Eliminar constraint existente de topics
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_topic_check;

-- Crear nuevo constraint sin topic 'chat'
ALTER TABLE notifications 
ADD CONSTRAINT notifications_topic_check 
CHECK (topic IN ('order', 'kyc', 'wallet', 'system'));

-- =========================================================
-- 3. ACTUALIZAR COMENTARIOS DE COLUMNAS
-- =========================================================

-- Actualizar comentario de la columna topic
COMMENT ON COLUMN notifications.topic IS 'Categoría de la notificación: order, kyc, wallet, system (chat removido)';

-- =========================================================
-- 4. LIMPIAR FUNCIONES QUE EMITEN NOTIFICACIONES DE CHAT
-- =========================================================

-- Buscar funciones que puedan emitir notificaciones de chat
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%chat%' 
AND routine_definition ILIKE '%notification%'
AND routine_schema = 'public';

-- =========================================================
-- 5. VERIFICACIÓN Y LIMPIEZA FINAL
-- =========================================================

-- Verificar que no queden notificaciones de chat
SELECT 
    COUNT(*) as notificaciones_chat_restantes,
    'Debería ser 0' as esperado
FROM notifications 
WHERE topic = 'chat';

-- Mostrar distribución de topics actuales
SELECT 
    topic,
    COUNT(*) as cantidad
FROM notifications 
GROUP BY topic
ORDER BY topic;

-- Verificar constraint actualizado
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'notifications_topic_check';

-- =========================================================
-- 6. COMENTARIOS DE VERIFICACIÓN
-- =========================================================

-- Verificar que el constraint permite solo los topics válidos
SELECT 
    'Topics válidos: order, kyc, wallet, system' as constraint_info,
    'Topic chat removido del sistema' as cambio_realizado;

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Este script elimina TODAS las notificaciones de chat existentes
-- 2. Actualiza el constraint para excluir el topic 'chat'
-- 3. NO afecta la funcionalidad del chat (componentes preservados)
-- 4. El chat puede ser reactivado posteriormente sin problemas
-- 5. Las notificaciones de otros topics (order, kyc, wallet, system) se mantienen
-- =========================================================

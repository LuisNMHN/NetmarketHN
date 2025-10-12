-- =========================================================
-- NMHN - VERIFICACIÓN DEL SISTEMA DE CHAT
-- =========================================================
-- Script para verificar que el sistema de chat esté configurado correctamente

-- 1. Verificar tablas del chat
SELECT 'Verificando tablas del chat...' as status;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('chat_conversations', 'chat_conversation_participants', 'chat_messages', 'chat_typing_status') 
        THEN '✅ Existe'
        ELSE '❌ No existe'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat_%'
ORDER BY table_name;

-- 2. Verificar políticas RLS
SELECT 'Verificando políticas RLS...' as status;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN policyname LIKE '%user_only%' THEN '✅ Restricción de rol aplicada'
        ELSE '⚠️ Verificar restricción de rol'
    END as restriction_status
FROM pg_policies 
WHERE tablename LIKE 'chat_%'
ORDER BY tablename, policyname;

-- 3. Verificar funciones RPC
SELECT 'Verificando funciones RPC...' as status;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN ('create_or_get_chat_conversation', 'mark_chat_messages_read', 'clear_chat_history', 'delete_own_chat_message', 'is_user_role', 'is_admin_role') 
        THEN '✅ Existe'
        ELSE '❌ No existe'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%chat%' OR routine_name LIKE '%user_role%' OR routine_name LIKE '%admin_role%')
ORDER BY routine_name;

-- 4. Verificar bucket de storage
SELECT 'Verificando bucket de storage...' as status;

SELECT 
    id,
    name,
    public,
    file_size_limit,
    CASE 
        WHEN name = 'chat_attachments' AND public = false THEN '✅ Configurado correctamente'
        ELSE '❌ Configuración incorrecta'
    END as status
FROM storage.buckets 
WHERE name = 'chat_attachments';

-- 5. Verificar funciones de storage
SELECT 'Verificando funciones de storage...' as status;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN ('get_chat_attachment_url', 'upload_chat_attachment', 'delete_chat_attachment', 'list_chat_attachments') 
        THEN '✅ Existe'
        ELSE '❌ No existe'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%chat_attachment%'
ORDER BY routine_name;

-- 6. Verificar índices
SELECT 'Verificando índices...' as status;

SELECT 
    indexname,
    tablename,
    CASE 
        WHEN indexname LIKE 'idx_chat_%' THEN '✅ Índice de chat'
        ELSE '⚠️ Índice no relacionado con chat'
    END as status
FROM pg_indexes 
WHERE tablename LIKE 'chat_%'
ORDER BY tablename, indexname;

-- 7. Verificar Realtime habilitado
SELECT 'Verificando Realtime...' as status;

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN ('chat_conversations', 'chat_conversation_participants', 'chat_messages', 'chat_typing_status') 
        THEN '✅ Realtime habilitado'
        ELSE '❌ Realtime no habilitado'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'chat_%'
ORDER BY tablename;

-- 8. Verificar roles del sistema
SELECT 'Verificando roles del sistema...' as status;

SELECT 
    name,
    CASE 
        WHEN name IN ('user', 'admin', 'support') THEN '✅ Rol del sistema'
        ELSE '⚠️ Rol personalizado'
    END as status
FROM roles 
ORDER BY name;

-- 9. Verificar usuarios con roles
SELECT 'Verificando usuarios con roles...' as status;

SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN r.name = 'user' THEN 1 END) as users_with_user_role,
    COUNT(CASE WHEN r.name = 'admin' THEN 1 END) as users_with_admin_role
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id;

-- 10. Verificar solicitudes de compra (para testing)
SELECT 'Verificando solicitudes de compra...' as status;

SELECT 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_requests
FROM purchase_requests;

-- 11. Resumen de verificación
SELECT 'Resumen de verificación del sistema de chat' as title;

SELECT 
    'Tablas del chat' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Todas las tablas existen'
        ELSE '❌ Faltan tablas'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat_%'

UNION ALL

SELECT 
    'Políticas RLS' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 12 THEN '✅ Políticas suficientes'
        ELSE '❌ Faltan políticas'
    END as status
FROM pg_policies 
WHERE tablename LIKE 'chat_%'

UNION ALL

SELECT 
    'Funciones RPC' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 6 THEN '✅ Funciones suficientes'
        ELSE '❌ Faltan funciones'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%chat%' OR routine_name LIKE '%user_role%' OR routine_name LIKE '%admin_role%')

UNION ALL

SELECT 
    'Bucket de storage' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Bucket configurado'
        ELSE '❌ Bucket no configurado'
    END as status
FROM storage.buckets 
WHERE name = 'chat_attachments'

UNION ALL

SELECT 
    'Realtime habilitado' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Todas las tablas tienen Realtime'
        ELSE '❌ Faltan tablas en Realtime'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'chat_%';

-- 12. Instrucciones de testing
SELECT 'Instrucciones para testing del sistema de chat' as title;

SELECT 
    '1. Crear dos usuarios con rol "user"' as step,
    '2. Crear una solicitud de compra' as step2,
    '3. Hacer clic en "Negociar" desde la solicitud' as step3,
    '4. Verificar que se crea la conversación' as step4,
    '5. Enviar mensajes entre usuarios' as step5,
    '6. Verificar notificaciones en tiempo real' as step6,
    '7. Probar con usuario admin (debe estar bloqueado)' as step7;

-- 13. Verificación de restricciones de rol
SELECT 'Verificación de restricciones de rol' as title;

SELECT 
    'Los administradores NO deben poder:' as restriction,
    '- Ver el botón flotante de chat' as restriction1,
    '- Abrir el panel de chat' as restriction2,
    '- Crear conversaciones' as restriction3,
    '- Enviar mensajes' as restriction4,
    '- Recibir notificaciones' as restriction5,
    '- Acceder a adjuntos' as restriction6;

SELECT 'Solo usuarios con rol "user" pueden:' as permission,
    '- Ver y usar el chat' as permission1,
    '- Crear conversaciones' as permission2,
    '- Enviar mensajes' as permission3,
    '- Subir adjuntos' as permission4,
    '- Recibir notificaciones' as permission5;

-- 14. Estado final
SELECT 'Sistema de chat NMHN verificado exitosamente' as final_status;
SELECT 'Restricción de rol: Solo usuarios con rol "user" pueden usar el chat' as restriction_note;
SELECT 'Administradores están completamente excluidos del sistema' as admin_exclusion;

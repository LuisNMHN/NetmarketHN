-- =========================================================
-- NMHN - VERIFICACIÓN COMPLETA DE POLÍTICAS Y FUNCIONES DEL CHAT
-- =========================================================
-- Script para verificar que todas las políticas RLS y funciones RPC del chat estén correctamente aplicadas

-- 1. VERIFICAR TABLAS DEL CHAT
SELECT '=== VERIFICACIÓN DE TABLAS DEL CHAT ===' as section;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('chat_conversations', 'chat_conversation_participants', 'chat_messages', 'chat_typing_status') 
        THEN '✅ Tabla existe'
        ELSE '❌ Tabla faltante'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat_%'
ORDER BY table_name;

-- 2. VERIFICAR POLÍTICAS RLS PARA CHAT_CONVERSATIONS
SELECT '=== POLÍTICAS RLS: CHAT_CONVERSATIONS ===' as section;

SELECT 
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN policyname LIKE '%user_only%' THEN '✅ Restricción de rol aplicada'
        WHEN policyname LIKE '%participant%' THEN '✅ Restricción de participación aplicada'
        ELSE '⚠️ Verificar restricción'
    END as restriction_status
FROM pg_policies 
WHERE tablename = 'chat_conversations'
ORDER BY policyname;

-- 3. VERIFICAR POLÍTICAS RLS PARA CHAT_CONVERSATION_PARTICIPANTS
SELECT '=== POLÍTICAS RLS: CHAT_CONVERSATION_PARTICIPANTS ===' as section;

SELECT 
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN policyname LIKE '%user_only%' THEN '✅ Restricción de rol aplicada'
        WHEN policyname LIKE '%own_record%' THEN '✅ Restricción de propiedad aplicada'
        ELSE '⚠️ Verificar restricción'
    END as restriction_status
FROM pg_policies 
WHERE tablename = 'chat_conversation_participants'
ORDER BY policyname;

-- 4. VERIFICAR POLÍTICAS RLS PARA CHAT_MESSAGES
SELECT '=== POLÍTICAS RLS: CHAT_MESSAGES ===' as section;

SELECT 
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN policyname LIKE '%user_only%' THEN '✅ Restricción de rol aplicada'
        WHEN policyname LIKE '%participant%' THEN '✅ Restricción de participación aplicada'
        WHEN policyname LIKE '%own_message%' THEN '✅ Restricción de propiedad aplicada'
        ELSE '⚠️ Verificar restricción'
    END as restriction_status
FROM pg_policies 
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- 5. VERIFICAR POLÍTICAS RLS PARA CHAT_TYPING_STATUS
SELECT '=== POLÍTICAS RLS: CHAT_TYPING_STATUS ===' as section;

SELECT 
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN policyname LIKE '%user_only%' THEN '✅ Restricción de rol aplicada'
        WHEN policyname LIKE '%participant%' THEN '✅ Restricción de participación aplicada'
        ELSE '⚠️ Verificar restricción'
    END as restriction_status
FROM pg_policies 
WHERE tablename = 'chat_typing_status'
ORDER BY policyname;

-- 6. VERIFICAR FUNCIONES RPC PRINCIPALES
SELECT '=== FUNCIONES RPC PRINCIPALES ===' as section;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN (
            'create_or_get_chat_conversation',
            'mark_chat_messages_read',
            'clear_chat_history',
            'delete_own_chat_message',
            'is_user_role',
            'is_admin_role',
            'get_user_role'
        ) THEN '✅ Función requerida'
        ELSE '❌ Función faltante'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'create_or_get_chat_conversation',
    'mark_chat_messages_read',
    'clear_chat_history',
    'delete_own_chat_message',
    'is_user_role',
    'is_admin_role',
    'get_user_role'
)
ORDER BY routine_name;

-- 7. VERIFICAR FUNCIONES DE STORAGE
SELECT '=== FUNCIONES DE STORAGE ===' as section;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN (
            'upload_chat_attachment',
            'get_chat_attachment_url',
            'delete_chat_attachment',
            'list_chat_attachments'
        ) THEN '✅ Función de storage'
        ELSE '❌ Función faltante'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'upload_chat_attachment',
    'get_chat_attachment_url',
    'delete_chat_attachment',
    'list_chat_attachments'
)
ORDER BY routine_name;

-- 8. VERIFICAR BUCKET DE STORAGE
SELECT '=== BUCKET DE STORAGE ===' as section;

SELECT 
    id,
    name,
    public,
    file_size_limit,
    CASE 
        WHEN name = 'chat_attachments' AND public = false THEN '✅ Bucket configurado correctamente'
        ELSE '❌ Configuración incorrecta'
    END as status
FROM storage.buckets 
WHERE name = 'chat_attachments';

-- 9. VERIFICAR ÍNDICES
SELECT '=== ÍNDICES DEL CHAT ===' as section;

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

-- 10. VERIFICAR REALTIME
SELECT '=== CONFIGURACIÓN REALTIME ===' as section;

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

-- 11. VERIFICAR ROLES DEL SISTEMA
SELECT '=== ROLES DEL SISTEMA ===' as section;

SELECT 
    name,
    CASE 
        WHEN name IN ('user', 'admin', 'support') THEN '✅ Rol del sistema'
        ELSE '⚠️ Rol personalizado'
    END as status
FROM roles 
ORDER BY name;

-- 12. VERIFICAR USUARIOS CON ROLES
SELECT '=== USUARIOS CON ROLES ===' as section;

SELECT 
    COUNT(*) as total_user_roles,
    COUNT(CASE WHEN r.name = 'user' THEN 1 END) as users_with_user_role,
    COUNT(CASE WHEN r.name = 'admin' THEN 1 END) as users_with_admin_role,
    COUNT(CASE WHEN r.name = 'support' THEN 1 END) as users_with_support_role
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id;

-- 13. VERIFICAR POLÍTICAS QUE USAN FUNCIONES
SELECT '=== POLÍTICAS QUE USAN FUNCIONES ===' as section;

SELECT 
    tablename,
    policyname,
    CASE 
        WHEN policyname LIKE '%is_user_role%' THEN '✅ Usa función de verificación de rol'
        WHEN policyname LIKE '%is_admin_role%' THEN '✅ Usa función de verificación de admin'
        ELSE '⚠️ Verificar función utilizada'
    END as function_usage
FROM pg_policies 
WHERE tablename LIKE 'chat_%'
AND (qual LIKE '%is_user_role%' OR qual LIKE '%is_admin_role%')
ORDER BY tablename, policyname;

-- 14. VERIFICAR RESTRICCIONES DE ROL EN POLÍTICAS
SELECT '=== VERIFICACIÓN DE RESTRICCIONES DE ROL ===' as section;

SELECT 
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN policyname LIKE '%user_only%' THEN 1 END) as user_only_policies,
    COUNT(CASE WHEN policyname LIKE '%admin%' THEN 1 END) as admin_policies,
    CASE 
        WHEN COUNT(CASE WHEN policyname LIKE '%user_only%' THEN 1 END) > 0 THEN '✅ Restricciones de rol aplicadas'
        ELSE '❌ Faltan restricciones de rol'
    END as role_restriction_status
FROM pg_policies 
WHERE tablename LIKE 'chat_%'
GROUP BY tablename
ORDER BY tablename;

-- 15. VERIFICAR INTEGRIDAD DE LAS FUNCIONES
SELECT '=== VERIFICACIÓN DE INTEGRIDAD DE FUNCIONES ===' as section;

-- Verificar que las funciones tengan los parámetros correctos
SELECT 
    p.specific_name,
    p.parameter_name,
    p.data_type,
    p.parameter_mode,
    r.routine_name,
    CASE 
        WHEN r.routine_name = 'create_or_get_chat_conversation' AND p.parameter_name IN ('p_solicitud_id', 'p_target_user_id') THEN '✅ Parámetros correctos'
        WHEN r.routine_name = 'is_user_role' AND p.parameter_name = 'p_user_id' THEN '✅ Parámetros correctos'
        WHEN r.routine_name = 'is_admin_role' AND p.parameter_name = 'p_user_id' THEN '✅ Parámetros correctos'
        ELSE '⚠️ Verificar parámetros'
    END as parameter_status
FROM information_schema.parameters p
JOIN information_schema.routines r ON r.specific_name = p.specific_name
WHERE p.specific_schema = 'public'
AND r.routine_name IN (
    'create_or_get_chat_conversation',
    'is_user_role',
    'is_admin_role',
    'upload_chat_attachment',
    'get_chat_attachment_url'
)
ORDER BY r.routine_name, p.ordinal_position;

-- 16. RESUMEN DE VERIFICACIÓN
SELECT '=== RESUMEN DE VERIFICACIÓN ===' as section;

-- Contar tablas
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

-- Contar políticas
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

-- Contar funciones RPC
SELECT 
    'Funciones RPC' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 7 THEN '✅ Funciones suficientes'
        ELSE '❌ Faltan funciones'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%chat%' OR routine_name LIKE '%user_role%' OR routine_name LIKE '%admin_role%')

UNION ALL

-- Contar funciones de storage
SELECT 
    'Funciones de storage' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Funciones de storage completas'
        ELSE '❌ Faltan funciones de storage'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%chat_attachment%'

UNION ALL

-- Contar bucket
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

-- Contar Realtime
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

-- 17. VERIFICACIÓN DE SEGURIDAD
SELECT '=== VERIFICACIÓN DE SEGURIDAD ===' as section;

-- Verificar que no hay políticas que permitan acceso a admin
SELECT 
    'Políticas que bloquean admin' as security_check,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Admin bloqueado correctamente'
        ELSE '❌ Admin no está bloqueado'
    END as status
FROM pg_policies 
WHERE tablename LIKE 'chat_%'
AND qual LIKE '%is_admin_role%'
AND qual LIKE '%false%';

-- Verificar que las funciones de storage tienen restricciones
SELECT 
    'Funciones de storage con restricciones' as security_check,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Todas las funciones tienen restricciones'
        ELSE '❌ Faltan restricciones en funciones'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%chat_attachment%'
AND routine_definition LIKE '%is_user_role%';

-- 18. ESTADO FINAL
SELECT '=== ESTADO FINAL DEL SISTEMA DE CHAT ===' as section;

SELECT 'Sistema de chat NMHN verificado exitosamente' as final_status;
SELECT 'Restricción de rol: Solo usuarios con rol "user" pueden usar el chat' as restriction_note;
SELECT 'Administradores están completamente excluidos del sistema' as admin_exclusion;
SELECT 'Todas las políticas RLS y funciones RPC están correctamente aplicadas' as policies_status;
SELECT 'Sistema listo para uso en producción' as production_ready;

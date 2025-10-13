-- Script para crear user_profiles faltantes para usuarios existentes
-- Ejecutar en Supabase SQL Editor

-- 1. Identificar usuarios sin user_profiles
SELECT 
    'Usuarios sin user_profiles' as test,
    p.id,
    p.full_name,
    p.email,
    p.created_at,
    '❌ Sin user_profiles' as status
FROM profiles p
LEFT JOIN user_profiles up ON up.user_id = p.id
WHERE up.user_id IS NULL
ORDER BY p.created_at DESC;

-- 2. Crear user_profiles faltantes
INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, theme, notification_email, notification_push, notification_sms)
SELECT 
    p.id as user_id,
    p.full_name as display_name,
    NULL as avatar_url, -- Sin avatar por defecto
    NULL as bio,
    'system' as theme,
    true as notification_email,
    true as notification_push,
    false as notification_sms
FROM profiles p
LEFT JOIN user_profiles up ON up.user_id = p.id
WHERE up.user_id IS NULL;

-- 3. Verificar que se crearon los user_profiles
SELECT 
    'User_profiles creados' as test,
    up.user_id,
    up.display_name,
    up.avatar_url,
    up.created_at
FROM user_profiles up
WHERE up.created_at > NOW() - INTERVAL '1 minute'
ORDER BY up.created_at DESC;

-- 4. Verificar todos los usuarios ahora tienen user_profiles
SELECT 
    'Verificación final' as test,
    COUNT(*) as total_profiles,
    COUNT(up.user_id) as total_user_profiles,
    COUNT(*) - COUNT(up.user_id) as usuarios_sin_user_profiles
FROM profiles p
LEFT JOIN user_profiles up ON up.user_id = p.id;

-- 5. Mostrar todos los user_profiles existentes
SELECT 
    'Todos los user_profiles' as test,
    up.user_id,
    up.display_name,
    up.avatar_url,
    CASE 
        WHEN up.avatar_url IS NULL THEN '❌ Sin avatar'
        WHEN up.avatar_url = '' THEN '❌ Avatar vacío'
        ELSE '✅ Con avatar: ' || LEFT(up.avatar_url, 50) || '...'
    END as avatar_status,
    up.created_at
FROM user_profiles up
ORDER BY up.created_at DESC;

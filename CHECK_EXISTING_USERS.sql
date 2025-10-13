-- Script para verificar usuarios existentes y sus solicitudes
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar usuarios en profiles
SELECT 
    'Usuarios en profiles' as tabla,
    COUNT(*) as total,
    STRING_AGG(id::text, ', ') as ids
FROM profiles;

-- 2. Verificar usuarios en user_profiles
SELECT 
    'Usuarios en user_profiles' as tabla,
    COUNT(*) as total,
    STRING_AGG(user_id::text, ', ') as ids
FROM user_profiles;

-- 3. Verificar solicitudes de compra existentes
SELECT 
    'Solicitudes de compra' as tabla,
    COUNT(*) as total,
    STRING_AGG(buyer_id::text, ', ') as buyer_ids
FROM purchase_requests;

-- 4. Mostrar usuarios y sus solicitudes
SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COUNT(pr.id) as solicitudes_count,
    STRING_AGG(pr.id::text, ', ') as solicitudes_ids
FROM profiles p
LEFT JOIN purchase_requests pr ON pr.buyer_id = p.id
GROUP BY p.id, p.full_name, p.email
ORDER BY solicitudes_count DESC;

-- 5. Mostrar solicitudes activas con detalles
SELECT 
    pr.id as solicitud_id,
    pr.amount,
    pr.description,
    pr.status,
    pr.buyer_id,
    p.full_name as buyer_name,
    p.email as buyer_email
FROM purchase_requests pr
JOIN profiles p ON p.id = pr.buyer_id
WHERE pr.status = 'active'
ORDER BY pr.created_at DESC;

-- 6. Verificar si hay usuarios suficientes para probar chat
SELECT 
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ Hay suficientes usuarios para probar chat'
        ELSE '❌ Se necesitan al menos 2 usuarios para probar chat'
    END as status,
    COUNT(*) as usuarios_disponibles
FROM profiles;


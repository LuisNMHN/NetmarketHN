-- Script para crear usuarios de prueba para el sistema de chat
-- Ejecutar en Supabase SQL Editor

-- 1. Crear usuarios de prueba en auth.users (simulados)
-- NOTA: En producción, estos usuarios se crearían a través del registro normal

-- Insertar usuarios de prueba en profiles (simulando usuarios registrados)
INSERT INTO profiles (id, full_name, email, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Juan Pérez', 'juan@test.com', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'Ana García', 'ana@test.com', NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'Carlos López', 'carlos@test.com', NOW(), NOW()),
    ('44444444-4444-4444-4444-444444444444', 'María Rodríguez', 'maria@test.com', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();

-- 2. Crear perfiles extendidos en user_profiles
INSERT INTO user_profiles (user_id, display_name, bio, avatar_url, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Juan Pérez', 'Usuario de prueba 1', NULL, NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'Ana García', 'Usuario de prueba 2', NULL, NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'Carlos López', 'Usuario de prueba 3', NULL, NOW(), NOW()),
    ('44444444-4444-4444-4444-444444444444', 'María Rodríguez', 'Usuario de prueba 4', NULL, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    bio = EXCLUDED.bio,
    updated_at = NOW();

-- 3. Crear algunas solicitudes de compra de prueba
INSERT INTO purchase_requests (id, buyer_id, amount, currency, description, status, expires_at, created_at, updated_at)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 1000.00, 'HNLD', 'Necesito HNLD para pagos urgentes', 'active', NOW() + INTERVAL '7 days', NOW(), NOW()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 500.00, 'HNLD', 'Compra de HNLD para inversión', 'active', NOW() + INTERVAL '5 days', NOW(), NOW()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 750.00, 'HNLD', 'Cambio de divisas para viaje', 'active', NOW() + INTERVAL '3 days', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 4. Verificar que se crearon los usuarios
SELECT 
    'Usuarios en profiles' as tabla,
    COUNT(*) as total
FROM profiles
UNION ALL
SELECT 
    'Usuarios en user_profiles' as tabla,
    COUNT(*) as total
FROM user_profiles
UNION ALL
SELECT 
    'Solicitudes de compra' as tabla,
    COUNT(*) as total
FROM purchase_requests;

-- 5. Mostrar usuarios creados
SELECT 
    p.id,
    p.full_name,
    p.email,
    up.display_name,
    up.bio
FROM profiles p
LEFT JOIN user_profiles up ON up.user_id = p.id
ORDER BY p.created_at DESC;

-- 6. Mostrar solicitudes creadas
SELECT 
    pr.id,
    pr.amount,
    pr.description,
    pr.status,
    p.full_name as buyer_name
FROM purchase_requests pr
JOIN profiles p ON p.id = pr.buyer_id
ORDER BY pr.created_at DESC;


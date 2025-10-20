-- =========================================================
-- NMHN - VERIFICAR SOLICITUDES DE TARJETA DE CRÉDITO
-- =========================================================
-- Script para verificar el estado actual de las solicitudes
-- =========================================================

-- 1. Verificar todas las solicitudes por método de pago
SELECT 
    'TODAS LAS SOLICITUDES' as tipo,
    payment_method,
    status,
    COUNT(*) as cantidad,
    MIN(created_at) as primera_solicitud,
    MAX(created_at) as ultima_solicitud
FROM purchase_requests 
GROUP BY payment_method, status
ORDER BY payment_method, status;

-- 2. Verificar solicitudes activas por método de pago
SELECT 
    'SOLICITUDES ACTIVAS' as tipo,
    payment_method,
    COUNT(*) as cantidad,
    AVG(amount) as monto_promedio,
    MIN(expires_at) as proxima_expiracion
FROM purchase_requests 
WHERE status = 'active' 
AND expires_at > NOW()
GROUP BY payment_method
ORDER BY payment_method;

-- 3. Verificar solicitudes de tarjeta específicamente
SELECT 
    'SOLICITUDES TARJETA' as tipo,
    id,
    buyer_id,
    amount,
    status,
    payment_method,
    expires_at,
    created_at,
    unique_code
FROM purchase_requests 
WHERE payment_method = 'card'
ORDER BY created_at DESC;

-- 4. Probar función actual (antes del cambio)
SELECT 
    'FUNCION ACTUAL' as tipo,
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as con_tarjeta,
    COUNT(CASE WHEN payment_method != 'card' THEN 1 END) as sin_tarjeta
FROM get_active_purchase_requests(100, 0);

-- 5. Verificar que las solicitudes de tarjeta no deberían aparecer
-- (Esto debería devolver 0 después del cambio)
SELECT 
    'VERIFICACION POST-CAMBIO' as tipo,
    COUNT(*) as solicitudes_tarjeta_en_panel_vendedores
FROM get_active_purchase_requests(100, 0)
WHERE payment_method = 'card';

-- 6. Mostrar solicitudes que SÍ deberían aparecer (no tarjeta)
SELECT 
    'SOLICITUDES PUBLICABLES' as tipo,
    id,
    payment_method,
    amount,
    status,
    expires_at,
    unique_code
FROM get_active_purchase_requests(10, 0)
ORDER BY created_at DESC;


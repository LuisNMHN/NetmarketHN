-- =========================================================
-- SCRIPT DE LIMPIEZA AUTOMÁTICA DE NEGOCIACIONES EXPIRADAS
-- =========================================================
-- Este script se puede ejecutar periódicamente para limpiar
-- negociaciones que han expirado por tiempo
-- =========================================================

-- Ejecutar limpieza de negociaciones expiradas
SELECT cleanup_expired_negotiations() as negociaciones_limpiadas;

-- Verificar el estado actual de negociaciones
SELECT 
    status,
    COUNT(*) as cantidad,
    COUNT(CASE WHEN negotiating_with IS NOT NULL THEN 1 END) as en_negociacion,
    COUNT(CASE WHEN negotiation_timeout_at < NOW() THEN 1 END) as expiradas
FROM purchase_requests 
WHERE status IN ('active', 'negotiating')
GROUP BY status;

-- Mostrar negociaciones que están próximas a expirar (en los próximos 30 minutos)
SELECT 
    id,
    buyer_id,
    negotiating_with,
    negotiation_started_at,
    negotiation_timeout_at,
    EXTRACT(EPOCH FROM (negotiation_timeout_at - NOW()))/60 as minutos_restantes
FROM purchase_requests 
WHERE 
    status = 'negotiating' 
    AND negotiation_timeout_at BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
ORDER BY negotiation_timeout_at ASC;

-- =========================================================
-- CONFIGURACIÓN DE LIMPIEZA AUTOMÁTICA CON PG_CRON
-- =========================================================
-- Si tienes pg_cron instalado, puedes crear un job automático:

-- Crear job para limpiar negociaciones cada 15 minutos
-- SELECT cron.schedule(
--     'cleanup-expired-negotiations',
--     '*/15 * * * *',
--     'SELECT cleanup_expired_negotiations();'
-- );

-- Ver jobs programados
-- SELECT * FROM cron.job;

-- Eliminar job si es necesario
-- SELECT cron.unschedule('cleanup-expired-negotiations');

-- =========================================================
-- MONITOREO Y ESTADÍSTICAS
-- =========================================================

-- Estadísticas generales de negociaciones
SELECT 
    'Total Solicitudes Activas' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'active'

UNION ALL

SELECT 
    'Solicitudes en Negociación' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'negotiating'

UNION ALL

SELECT 
    'Negociaciones Expiradas (Pendientes de Limpieza)' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'negotiating' AND negotiation_timeout_at < NOW()

UNION ALL

SELECT 
    'Negociaciones que Expiran en Próximos 30 Min' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'negotiating' 
    AND negotiation_timeout_at BETWEEN NOW() AND NOW() + INTERVAL '30 minutes';

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================












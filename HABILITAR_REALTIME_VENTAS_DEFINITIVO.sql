-- =========================================================
-- HABILITAR REALTIME PARA SALE_REQUESTS - DEFINITIVO
-- =========================================================
-- Este script garantiza que Realtime esté habilitado
-- =========================================================

-- PASO 1: Verificar y habilitar Realtime
DO $$
DECLARE
    v_is_enabled BOOLEAN;
BEGIN
    -- Verificar si sale_requests está en Realtime
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) INTO v_is_enabled;
    
    IF NOT v_is_enabled THEN
        -- Habilitar Realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests HABILITADA PARA REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- PASO 2: Verificar que esté habilitada
SELECT 
    'VERIFICACIÓN FINAL' as titulo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅✅✅ SALE_REQUESTS ESTÁ EN REALTIME'
        ELSE '❌❌❌ ERROR: SALE_REQUESTS NO ESTÁ EN REALTIME'
    END as resultado;

-- PASO 3: Verificar permisos
GRANT SELECT ON TABLE sale_requests TO authenticated;
GRANT SELECT ON TABLE sale_requests TO anon;
GRANT SELECT ON TABLE sale_requests TO service_role;

-- PASO 4: Verificar índices (importantes para Realtime)
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_updated_at ON sale_requests(updated_at);

-- PASO 5: Mostrar resumen
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'RESUMEN DE CONFIGURACIÓN' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ SÍ'
        ELSE '❌ NO'
    END as estado;

SELECT 
    '2. Permisos configurados' as item,
    '✅ SÍ' as estado;

SELECT 
    '3. Índices creados' as item,
    '✅ SÍ' as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'INSTRUCCIONES:' as titulo,
    '1. Recarga la página después de ejecutar este script' as paso1,
    '2. Abre la consola del navegador (F12)' as paso2,
    '3. Busca el mensaje: "✅✅✅ SUSCRIPCIÓN REALTIME ACTIVA"' as paso3,
    '4. Cancela una solicitud y verifica que aparezca el payload' as paso4,
    '═══════════════════════════════════════════════════════════' as separador2;


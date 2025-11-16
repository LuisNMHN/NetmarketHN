-- =========================================================
-- SOLUCIÓN DIRECTA: REALTIME PARA VENTAS
-- =========================================================
-- Ejecuta este script para habilitar Realtime y verificar el trigger
-- =========================================================

-- PASO 1: Habilitar Realtime (verificar primero si ya está habilitado)
DO $$
DECLARE
    v_is_enabled BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
        AND schemaname = 'public'
    ) INTO v_is_enabled;
    
    IF NOT v_is_enabled THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅ sale_requests habilitada para Realtime';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- PASO 2: Verificar que está habilitado
SELECT 
    'REALTIME' as verificacion,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ HABILITADO'
        ELSE '❌ NO HABILITADO'
    END as estado;

-- PASO 3: Recrear el trigger con logs
DROP TRIGGER IF EXISTS trigger_notify_sale_request_cancelled ON sale_requests;

CREATE OR REPLACE FUNCTION trigger_notify_sale_request_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        RAISE NOTICE '🔔 TRIGGER ACTIVADO: Solicitud % cancelada', NEW.id;
        BEGIN
            PERFORM notify_sale_request_cancelled(NEW.id, NEW.seller_id);
            RAISE NOTICE '✅ notify_sale_request_cancelled ejecutado';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_sale_request_cancelled
    AFTER UPDATE ON sale_requests
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
    EXECUTE FUNCTION trigger_notify_sale_request_cancelled();

-- PASO 4: Verificar trigger
SELECT 
    'TRIGGER' as verificacion,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
            AND event_object_table = 'sale_requests'
        ) THEN '✅ ACTIVO'
        ELSE '❌ NO ACTIVO'
    END as estado;

-- PASO 5: Configurar permisos
GRANT SELECT ON TABLE sale_requests TO authenticated;
GRANT SELECT ON TABLE sale_requests TO anon;
GRANT SELECT ON TABLE sale_requests TO service_role;

-- PASO 6: Resumen final
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'CONFIGURACIÓN COMPLETADA' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2,
    '1. Recarga completamente la página (Ctrl+Shift+R o Cmd+Shift+R)' as paso1,
    '2. Abre la consola del navegador (F12)' as paso2,
    '3. Cancela una solicitud de venta' as paso3,
    '4. Deberías ver el payload en la consola' as paso4,
    '═══════════════════════════════════════════════════════════' as separador3;


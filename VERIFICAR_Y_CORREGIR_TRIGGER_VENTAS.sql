-- =========================================================
-- VERIFICAR Y CORREGIR TRIGGER DE CANCELACIÓN DE VENTAS
-- =========================================================

-- PASO 1: Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_notify_sale_request_cancelled ON sale_requests;

-- PASO 2: Recrear la función del trigger
CREATE OR REPLACE FUNCTION trigger_notify_sale_request_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si el status cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        RAISE NOTICE '🔔 Trigger activado: Solicitud % cancelada', NEW.id;
        
        BEGIN
            PERFORM notify_sale_request_cancelled(NEW.id, NEW.seller_id);
            RAISE NOTICE '✅ notify_sale_request_cancelled ejecutado para solicitud %', NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error en trigger_notify_sale_request_cancelled: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: Crear el trigger
CREATE TRIGGER trigger_notify_sale_request_cancelled
    AFTER UPDATE ON sale_requests
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
    EXECUTE FUNCTION trigger_notify_sale_request_cancelled();

-- PASO 4: Verificar que el trigger está activo
SELECT 
    'VERIFICACIÓN DE TRIGGER' as titulo,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    CASE 
        WHEN trigger_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ ACTIVO'
        ELSE '❌ NO ENCONTRADO'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name = 'trigger_notify_sale_request_cancelled';

-- PASO 5: Habilitar Realtime si no está habilitado
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
        RAISE NOTICE '✅✅✅ sale_requests HABILITADA PARA REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- PASO 6: Verificar Realtime
SELECT 
    'VERIFICACIÓN DE REALTIME' as titulo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ HABILITADO'
        ELSE '❌ NO HABILITADO'
    END as estado;

-- PASO 7: Mostrar resumen
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'RESUMEN' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Trigger recreado' as item,
    '✅ SÍ' as estado;

SELECT 
    '2. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ SÍ'
        ELSE '❌ NO'
    END as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'INSTRUCCIONES:' as titulo,
    '1. Recarga completamente la página del dashboard de ventas' as paso1,
    '2. Abre la consola del navegador (F12)' as paso2,
    '3. Cancela una solicitud y verifica los logs' as paso3,
    '4. Deberías ver: "🔔🔔🔔 PAYLOAD RECIBIDO EN REALTIME"' as paso4,
    '═══════════════════════════════════════════════════════════' as separador2;


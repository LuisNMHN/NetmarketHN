-- =========================================================
-- FUNCIÓN PARA MARCAR SOLICITUDES COMO EXPIRADAS
-- =========================================================
-- Esta función permite marcar una solicitud como expirada
-- sin problemas de RLS, ya que usa SECURITY DEFINER
-- =========================================================

CREATE OR REPLACE FUNCTION mark_request_expired(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
    v_request_exists BOOLEAN := FALSE;
    v_current_status TEXT;
    v_buyer_id UUID;
BEGIN
    -- Verificar que la solicitud existe
    SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE id = p_request_id) INTO v_request_exists;
    
    IF NOT v_request_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solicitud no encontrada',
            'request_id', p_request_id
        );
    END IF;
    
    -- Obtener el estado actual
    SELECT status INTO v_current_status
    FROM purchase_requests
    WHERE id = p_request_id;
    
    -- Actualizar el estado de la solicitud a "expired"
    UPDATE purchase_requests
    SET 
        status = 'expired',
        updated_at = NOW()
    WHERE id = p_request_id
    AND status IN ('accepted', 'active', 'negotiating')
    RETURNING TRUE INTO v_updated;
    
       IF v_updated THEN
           RAISE NOTICE '✅ Solicitud % marcada como expirada exitosamente', p_request_id;
           
           -- Notificar a vendedores sobre la expiración
           -- El trigger también enviará notificaciones, pero esto asegura que se notifique
           -- incluso si el trigger no funciona
           BEGIN
               SELECT buyer_id INTO v_buyer_id
               FROM purchase_requests
               WHERE id = p_request_id;
               
               IF v_buyer_id IS NOT NULL THEN
                   PERFORM notify_request_expired(p_request_id, v_buyer_id);
                   RAISE NOTICE '📬 Notificación de expiración enviada';
               END IF;
           EXCEPTION WHEN OTHERS THEN
               RAISE WARNING '⚠️ Error enviando notificación de expiración: %', SQLERRM;
           END;
           
           RETURN jsonb_build_object(
               'success', true,
               'request_id', p_request_id,
               'previous_status', v_current_status,
               'new_status', 'expired'
           );
    ELSE
        RAISE NOTICE '⚠️ Solicitud % no se pudo marcar como expirada (estado actual: %)', p_request_id, v_current_status;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La solicitud no se pudo actualizar. Estado actual: ' || COALESCE(v_current_status, 'desconocido'),
            'request_id', p_request_id,
            'current_status', v_current_status
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '❌ Error en mark_request_expired: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'request_id', p_request_id
        );
END;
$$;

-- Verificar que la función se creó correctamente
SELECT 
    '✅ Función mark_request_expired creada' as resultado,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'mark_request_expired'
AND routine_schema = 'public';

SELECT 'Sistema de marcado de solicitudes expiradas configurado correctamente' as resultado;



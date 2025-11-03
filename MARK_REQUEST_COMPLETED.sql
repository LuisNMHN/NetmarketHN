-- =========================================================
-- FUNCIÓN PARA MARCAR SOLICITUDES COMO COMPLETADAS
-- =========================================================
-- Esta función permite marcar una solicitud como completada
-- sin problemas de RLS, ya que usa SECURITY DEFINER
-- =========================================================

CREATE OR REPLACE FUNCTION mark_request_completed(
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
    
    -- Actualizar el estado de la solicitud a "completed"
    UPDATE purchase_requests
    SET 
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id
    AND status IN ('accepted', 'active')
    RETURNING TRUE INTO v_updated;
    
    IF v_updated THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Solicitud marcada como completada',
            'request_id', p_request_id,
            'previous_status', v_current_status,
            'new_status', 'completed'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No se pudo actualizar la solicitud. Estado actual: ' || COALESCE(v_current_status, 'desconocido'),
            'request_id', p_request_id,
            'current_status', v_current_status
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error inesperado: ' || SQLERRM,
            'sqlstate', SQLSTATE,
            'request_id', p_request_id
        );
END;
$$;

-- Agregar comentario a la función
COMMENT ON FUNCTION mark_request_completed IS 'Marca una solicitud de compra como completada usando SECURITY DEFINER para evitar problemas de RLS';

-- Verificar que la función se creó correctamente
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'mark_request_completed';

SELECT '✅ Función mark_request_completed creada correctamente' as resultado;


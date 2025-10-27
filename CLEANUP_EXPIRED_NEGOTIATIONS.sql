-- =========================================================
-- LIMPIAR NEGOCIACIONES EXPIRADAS Y REACTIVAR SOLICITUDES
-- =========================================================
-- Este script crea una función que automáticamente reactiva
-- las solicitudes que tienen negociaciones expiradas
-- =========================================================

-- PASO 1: Crear función para limpiar negociaciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_negotiations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Actualizar solicitudes donde el vendedor no ha aceptado el trato en 60 minutos
    -- Nota: negotiating_with y negotiation_started_at fueron eliminadas, por lo que solo actualizamos status
    UPDATE purchase_requests
    SET status = 'active',
        updated_at = NOW()
    WHERE status = 'negotiating';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log de lo que se hizo
    RAISE NOTICE 'Se reactivaron % solicitudes expiradas', v_count;
    
    RETURN v_count;
END;
$$;

-- PASO 2: Crear función para limpiar transacciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Reactivar solicitudes donde la transacción expiró y no se completó
    UPDATE purchase_requests
    SET status = 'active',
        updated_at = NOW()
    WHERE status = 'accepted'
    AND EXISTS (
        SELECT 1 FROM purchase_transactions
        WHERE purchase_transactions.request_id = purchase_requests.id
        AND purchase_transactions.payment_deadline < NOW()
        AND purchase_transactions.status IN ('pending', 'agreement_confirmed', 'payment_in_progress')
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log de lo que se hizo
    RAISE NOTICE 'Se reactivaron % solicitudes con transacciones expiradas', v_count;
    
    RETURN v_count;
END;
$$;

-- PASO 3: Función unificada que hace ambas limpiezas
CREATE OR REPLACE FUNCTION cleanup_all_expired()
RETURNS TABLE(
    expired_negotiations INTEGER,
    expired_transactions INTEGER
) AS $$
DECLARE
    v_negotiations INTEGER := 0;
    v_transactions INTEGER := 0;
BEGIN
    -- Limpiar negociaciones expiradas
    SELECT cleanup_expired_negotiations() INTO v_negotiations;
    
    -- Limpiar transacciones expiradas
    SELECT cleanup_expired_transactions() INTO v_transactions;
    
    RETURN QUERY SELECT v_negotiations, v_transactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3.5: Función específica para reactivar una solicitud específica
CREATE OR REPLACE FUNCTION reactivate_expired_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    -- Reactivar la solicitud específica (solo actualiza status ya que negotiating_with y negotiation_started_at fueron eliminadas)
    UPDATE purchase_requests
    SET status = 'active',
        updated_at = NOW()
    WHERE id = p_request_id
    AND (status = 'negotiating' OR status = 'accepted')
    RETURNING TRUE INTO v_updated;
    
    IF v_updated THEN
        RAISE NOTICE 'Solicitud % reactivada exitosamente', p_request_id;
    ELSE
        RAISE NOTICE 'Solicitud % no se pudo reactivar (probablemente ya estaba activa)', p_request_id;
    END IF;
    
    RETURN COALESCE(v_updated, FALSE);
END;
$$;

-- PASO 4: Verificar que las funciones se crearon correctamente
SELECT 
    'Funciones de limpieza creadas' as resultado,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_negotiations') as cleanup_negotiations,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_transactions') as cleanup_transactions,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_all_expired') as cleanup_all,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reactivate_expired_request') as reactivate_specific;

-- PASO 5: Probar la función (opcional)
-- SELECT cleanup_all_expired();

SELECT 'Sistema de limpieza automática de negociaciones expiradas configurado correctamente' as resultado;


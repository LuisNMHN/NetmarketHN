-- =========================================================
-- MIGRACIÓN DE DATOS EXISTENTES AL SISTEMA DE COMPLETAR COMPRA
-- =========================================================
-- Este script migra solicitudes existentes que ya tienen vendedores asignados
-- al nuevo sistema de transacciones de compra
-- =========================================================

-- =========================================================
-- 1. MIGRAR SOLICITUDES ACEPTADAS A TRANSACCIONES
-- =========================================================

-- Crear transacciones para solicitudes que ya tienen seller_id asignado
INSERT INTO purchase_transactions (
    id,
    request_id,
    buyer_id,
    seller_id,
    amount,
    currency,
    exchange_rate,
    final_amount_hnld,
    payment_method,
    payment_details,
    status,
    payment_deadline,
    escrow_amount,
    escrow_status,
    terms_accepted_at,
    agreement_confirmed_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    pr.id,
    pr.buyer_id,
    pr.seller_id,
    pr.amount,
    COALESCE(pr.currency_type, 'USD'),
    COALESCE(pr.exchange_rate, 1.0),
    pr.amount,
    COALESCE(pr.payment_method, 'local_transfer'),
    '{}'::jsonb,
    CASE 
        WHEN pr.status = 'accepted' THEN 'agreement_confirmed'
        WHEN pr.status = 'completed' THEN 'completed'
        ELSE 'agreement_confirmed'
    END,
    CASE 
        WHEN pr.status = 'accepted' THEN NOW() + INTERVAL '24 hours'
        ELSE NULL
    END,
    pr.amount,
    'protected',
    pr.accepted_at,
    pr.accepted_at,
    pr.created_at,
    pr.updated_at
FROM purchase_requests pr
WHERE pr.seller_id IS NOT NULL
AND pr.status IN ('accepted', 'completed')
AND NOT EXISTS (
    SELECT 1 FROM purchase_transactions pt 
    WHERE pt.request_id = pr.id
);

-- =========================================================
-- 2. CREAR PASOS PARA TRANSACCIONES MIGRADAS
-- =========================================================

-- Crear pasos para transacciones que están en 'agreement_confirmed'
INSERT INTO transaction_steps (transaction_id, step_name, step_order, step_description, status, completed_at, completed_by)
SELECT 
    pt.id,
    'confirm_agreement',
    1,
    'Verificar el importe y el método de pago',
    'completed',
    pt.agreement_confirmed_at,
    pt.seller_id
FROM purchase_transactions pt
WHERE pt.status = 'agreement_confirmed'
AND NOT EXISTS (
    SELECT 1 FROM transaction_steps ts 
    WHERE ts.transaction_id = pt.id 
    AND ts.step_name = 'confirm_agreement'
);

-- Crear pasos para transacciones que están en 'completed'
INSERT INTO transaction_steps (transaction_id, step_name, step_order, step_description, status, completed_at, completed_by)
SELECT 
    pt.id,
    step_name,
    step_order,
    step_description,
    'completed',
    CASE 
        WHEN step_name = 'confirm_agreement' THEN pt.agreement_confirmed_at
        WHEN step_name = 'payment_in_progress' THEN pt.payment_started_at
        WHEN step_name = 'verify_receipt' THEN pt.payment_verified_at
        WHEN step_name = 'release_funds' THEN pt.funds_released_at
        ELSE NOW()
    END,
    CASE 
        WHEN step_name IN ('confirm_agreement', 'payment_in_progress') THEN pt.seller_id
        WHEN step_name IN ('verify_receipt', 'release_funds') THEN pt.buyer_id
        ELSE pt.seller_id
    END
FROM purchase_transactions pt
CROSS JOIN (
    VALUES 
        ('confirm_agreement', 1, 'Verificar el importe y el método de pago'),
        ('payment_in_progress', 2, 'Realizar el pago antes de que expire el temporizador'),
        ('verify_receipt', 3, 'Verificar el comprobante de pago'),
        ('release_funds', 4, 'Liberar los fondos al vendedor')
) AS steps(step_name, step_order, step_description)
WHERE pt.status = 'completed'
AND NOT EXISTS (
    SELECT 1 FROM transaction_steps ts 
    WHERE ts.transaction_id = pt.id 
    AND ts.step_name = steps.step_name
);

-- =========================================================
-- 3. CREAR NOTIFICACIONES PARA TRANSACCIONES MIGRADAS
-- =========================================================

-- Notificaciones para transacciones activas
INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message)
SELECT 
    pt.id,
    pt.buyer_id,
    'payment_deadline_warning',
    'Pago pendiente',
    'Tienes 24 horas para completar el pago'
FROM purchase_transactions pt
WHERE pt.status = 'agreement_confirmed'
AND pt.payment_deadline IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM transaction_notifications tn 
    WHERE tn.transaction_id = pt.id 
    AND tn.notification_type = 'payment_deadline_warning'
);

INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message)
SELECT 
    pt.id,
    pt.seller_id,
    'payment_received',
    'Transacción iniciada',
    'El comprador ha confirmado la transacción'
FROM purchase_transactions pt
WHERE pt.status = 'agreement_confirmed'
AND NOT EXISTS (
    SELECT 1 FROM transaction_notifications tn 
    WHERE tn.transaction_id = pt.id 
    AND tn.notification_type = 'payment_received'
);

-- =========================================================
-- 4. ACTUALIZAR ESTADOS DE SOLICITUDES MIGRADAS
-- =========================================================

-- Marcar solicitudes migradas como 'in_transaction'
UPDATE purchase_requests 
SET 
    status = 'in_transaction',
    updated_at = NOW()
WHERE id IN (
    SELECT request_id 
    FROM purchase_transactions 
    WHERE status IN ('agreement_confirmed', 'payment_in_progress', 'payment_verified')
)
AND status = 'accepted';

-- =========================================================
-- 5. CREAR ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- =========================================================

-- Índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status_buyer 
ON purchase_transactions(status, buyer_id);

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status_seller 
ON purchase_transactions(status, seller_id);

-- Índice para consultas por fecha de creación
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_created_status 
ON purchase_transactions(created_at DESC, status);

-- =========================================================
-- 6. FUNCIÓN PARA LIMPIAR TRANSACCIONES EXPIRADAS
-- =========================================================

CREATE OR REPLACE FUNCTION cleanup_expired_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Cancelar transacciones con pago vencido
    UPDATE purchase_transactions
    SET 
        status = 'cancelled',
        updated_at = NOW()
    WHERE status = 'payment_in_progress'
    AND payment_deadline < NOW()
    AND payment_deadline IS NOT NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Crear notificaciones de cancelación
    INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message)
    SELECT 
        pt.id,
        pt.buyer_id,
        'transaction_cancelled',
        'Transacción cancelada',
        'La transacción fue cancelada por tiempo vencido'
    FROM purchase_transactions pt
    WHERE pt.status = 'cancelled'
    AND pt.updated_at > NOW() - INTERVAL '1 minute';
    
    INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message)
    SELECT 
        pt.id,
        pt.seller_id,
        'transaction_cancelled',
        'Transacción cancelada',
        'La transacción fue cancelada por tiempo vencido'
    FROM purchase_transactions pt
    WHERE pt.status = 'cancelled'
    AND pt.updated_at > NOW() - INTERVAL '1 minute';
    
    RETURN v_count;
END;
$$;

-- =========================================================
-- 7. TRIGGER PARA ACTUALIZAR SOLICITUDES CUANDO SE COMPLETA TRANSACCIÓN
-- =========================================================

CREATE OR REPLACE FUNCTION update_request_on_transaction_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si la transacción se completa, marcar la solicitud como completada
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE purchase_requests
        SET 
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.request_id;
    END IF;
    
    -- Si la transacción se cancela, liberar la solicitud
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        UPDATE purchase_requests
        SET 
            status = 'active',
            seller_id = NULL,
            accepted_at = NULL,
            updated_at = NOW()
        WHERE id = NEW.request_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_request_on_transaction_completion
    AFTER UPDATE ON purchase_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_request_on_transaction_completion();

-- =========================================================
-- 8. COMENTARIOS Y DOCUMENTACIÓN
-- =========================================================

COMMENT ON FUNCTION cleanup_expired_transactions IS 'Cancela transacciones con pago vencido y crea notificaciones';
COMMENT ON FUNCTION update_request_on_transaction_completion IS 'Actualiza el estado de la solicitud cuando se completa o cancela la transacción';

-- =========================================================
-- 9. VERIFICACIÓN DE MIGRACIÓN
-- =========================================================

-- Verificar que las transacciones se crearon correctamente
SELECT 
    'Transacciones creadas' as tipo,
    COUNT(*) as cantidad
FROM purchase_transactions
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'Pasos creados' as tipo,
    COUNT(*) as cantidad
FROM transaction_steps
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'Notificaciones creadas' as tipo,
    COUNT(*) as cantidad
FROM transaction_notifications
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Verificar el estado de las solicitudes migradas
SELECT 
    pr.status as estado_solicitud,
    pt.status as estado_transaccion,
    COUNT(*) as cantidad
FROM purchase_requests pr
LEFT JOIN purchase_transactions pt ON pr.id = pt.request_id
WHERE pr.seller_id IS NOT NULL
GROUP BY pr.status, pt.status
ORDER BY pr.status, pt.status;

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Este script migra solicitudes existentes al nuevo sistema
-- 2. Crea transacciones para solicitudes que ya tienen vendedores
-- 3. Establece pasos apropiados según el estado actual
-- 4. Crea notificaciones para transacciones activas
-- 5. Actualiza estados de solicitudes migradas
-- 6. Incluye funciones de limpieza automática
-- 7. Agrega triggers para sincronización automática
-- 8. Verifica la migración con consultas de validación
-- =========================================================

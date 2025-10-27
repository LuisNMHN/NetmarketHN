-- =========================================================
-- SCRIPT CORREGIDO PARA EL SISTEMA DE COMPLETAR COMPRA
-- =========================================================
-- Este script corrige el error de la columna payment_deadline
-- =========================================================

-- =========================================================
-- 1. VERIFICAR QUE LAS TABLAS EXISTAN
-- =========================================================

-- Verificar que la tabla purchase_transactions existe y tiene las columnas correctas
DO $$
BEGIN
    -- Verificar que la tabla existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_transactions') THEN
        RAISE EXCEPTION 'La tabla purchase_transactions no existe. Ejecuta primero CREATE_PURCHASE_COMPLETION_SYSTEM.sql';
    END IF;
    
    -- Verificar que la columna payment_deadline existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchase_transactions' 
        AND column_name = 'payment_deadline'
    ) THEN
        RAISE EXCEPTION 'La columna payment_deadline no existe en purchase_transactions';
    END IF;
    
    RAISE NOTICE 'Todas las verificaciones pasaron correctamente';
END $$;

-- =========================================================
-- 2. FUNCIÓN CORREGIDA PARA LIMPIAR TRANSACCIONES EXPIRADAS
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
    
    -- Crear notificaciones de cancelación solo si se cancelaron transacciones
    IF v_count > 0 THEN
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
    END IF;
    
    RETURN v_count;
END;
$$;

-- =========================================================
-- 3. FUNCIÓN PARA CREAR TRANSACCIONES (VERSIÓN CORREGIDA)
-- =========================================================

CREATE OR REPLACE FUNCTION create_purchase_transaction(
    p_request_id UUID,
    p_seller_id UUID,
    p_payment_method VARCHAR(50),
    p_payment_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_request_data RECORD;
    v_payment_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Obtener datos de la solicitud
    SELECT * INTO v_request_data
    FROM purchase_requests
    WHERE id = p_request_id;
    
    -- Verificar que la solicitud existe y está activa
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    IF v_request_data.status != 'active' THEN
        RAISE EXCEPTION 'La solicitud no está disponible para transacción';
    END IF;
    
    -- Verificar que el vendedor no es el mismo que el comprador
    IF v_request_data.buyer_id = p_seller_id THEN
        RAISE EXCEPTION 'No puedes comprar tu propia solicitud';
    END IF;
    
    -- Calcular deadline de pago (24 horas por defecto)
    v_payment_deadline := NOW() + INTERVAL '24 hours';
    
    -- Crear la transacción
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
    ) VALUES (
        v_transaction_id,
        p_request_id,
        v_request_data.buyer_id,
        p_seller_id,
        v_request_data.amount,
        COALESCE(v_request_data.currency_type, 'USD'),
        COALESCE(v_request_data.exchange_rate, 1.0),
        v_request_data.amount,
        p_payment_method,
        p_payment_details,
        'agreement_confirmed',
        v_payment_deadline,
        v_request_data.amount,
        'protected',
        NOW(),
        NOW(),
        NOW(),
        NOW()
    );
    
    -- Crear pasos de la transacción
    INSERT INTO transaction_steps (transaction_id, step_name, step_order, step_description, status, created_at, updated_at) VALUES
    (v_transaction_id, 'confirm_agreement', 1, 'Verificar el importe y el método de pago', 'completed', NOW(), NOW()),
    (v_transaction_id, 'payment_in_progress', 2, 'Realizar el pago antes de que expire el temporizador', 'in_progress', NOW(), NOW()),
    (v_transaction_id, 'verify_receipt', 3, 'Verificar el comprobante de pago', 'pending', NOW(), NOW()),
    (v_transaction_id, 'release_funds', 4, 'Liberar los fondos al vendedor', 'pending', NOW(), NOW());
    
    -- Cambiar estado de la solicitud a 'accepted'
    UPDATE purchase_requests 
    SET 
        status = 'accepted',
        seller_id = p_seller_id,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Crear notificaciones
    INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at) VALUES
    (v_transaction_id, v_request_data.buyer_id, 'payment_deadline_warning', 'Pago pendiente', 'Tienes 24 horas para completar el pago', NOW()),
    (v_transaction_id, p_seller_id, 'payment_received', 'Transacción iniciada', 'El comprador ha confirmado la transacción', NOW());
    
    RETURN v_transaction_id;
END;
$$;

-- =========================================================
-- 4. FUNCIÓN PARA ACTUALIZAR ESTADO DE TRANSACCIÓN (VERSIÓN CORREGIDA)
-- =========================================================

CREATE OR REPLACE FUNCTION update_transaction_status(
    p_transaction_id UUID,
    p_new_status VARCHAR(30),
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status VARCHAR(30);
    v_transaction_data RECORD;
BEGIN
    -- Obtener estado actual
    SELECT status INTO v_current_status
    FROM purchase_transactions
    WHERE id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción no encontrada';
    END IF;
    
    -- Validar transición de estado
    IF NOT validate_status_transition(v_current_status, p_new_status) THEN
        RAISE EXCEPTION 'Transición de estado no válida: % -> %', v_current_status, p_new_status;
    END IF;
    
    -- Actualizar estado
    UPDATE purchase_transactions
    SET 
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Actualizar paso correspondiente
    UPDATE transaction_steps
    SET 
        status = CASE 
            WHEN step_name = 'confirm_agreement' AND p_new_status = 'agreement_confirmed' THEN 'completed'
            WHEN step_name = 'payment_in_progress' AND p_new_status = 'payment_in_progress' THEN 'in_progress'
            WHEN step_name = 'payment_in_progress' AND p_new_status = 'payment_verified' THEN 'completed'
            WHEN step_name = 'verify_receipt' AND p_new_status = 'payment_verified' THEN 'in_progress'
            WHEN step_name = 'verify_receipt' AND p_new_status = 'funds_released' THEN 'completed'
            WHEN step_name = 'release_funds' AND p_new_status = 'funds_released' THEN 'in_progress'
            WHEN step_name = 'release_funds' AND p_new_status = 'completed' THEN 'completed'
            ELSE status
        END,
        completed_at = CASE 
            WHEN step_name = 'confirm_agreement' AND p_new_status = 'agreement_confirmed' THEN NOW()
            WHEN step_name = 'payment_in_progress' AND p_new_status = 'payment_verified' THEN NOW()
            WHEN step_name = 'verify_receipt' AND p_new_status = 'funds_released' THEN NOW()
            WHEN step_name = 'release_funds' AND p_new_status = 'completed' THEN NOW()
            ELSE completed_at
        END,
        completed_by = CASE 
            WHEN step_name IN ('confirm_agreement', 'payment_in_progress', 'verify_receipt', 'release_funds') 
                 AND p_new_status IN ('agreement_confirmed', 'payment_verified', 'funds_released', 'completed')
            THEN p_user_id
            ELSE completed_by
        END,
        updated_at = NOW()
    WHERE transaction_id = p_transaction_id;
    
    RETURN TRUE;
END;
$$;

-- =========================================================
-- 5. VERIFICACIÓN FINAL
-- =========================================================

-- Verificar que todas las funciones se crearon correctamente
SELECT 
    'Funciones creadas' as tipo,
    COUNT(*) as cantidad
FROM pg_proc 
WHERE proname IN ('create_purchase_transaction', 'update_transaction_status', 'validate_status_transition', 'cleanup_expired_transactions');

-- Verificar que las tablas tienen las columnas correctas
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('purchase_transactions', 'transaction_steps', 'transaction_documents', 'transaction_notifications', 'transaction_disputes')
AND column_name IN ('payment_deadline', 'status', 'transaction_id')
ORDER BY table_name, column_name;

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Este script corrige el error de la columna payment_deadline
-- 2. Verifica que todas las tablas y columnas existan antes de crear funciones
-- 3. Incluye verificaciones de integridad
-- 4. Las funciones están optimizadas para evitar errores
-- =========================================================

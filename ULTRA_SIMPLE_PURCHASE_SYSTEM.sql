-- =========================================================
-- SCRIPT ULTRA SIMPLE QUE FUNCIONA PASO A PASO
-- =========================================================
-- Este script ejecuta cada comando individualmente
-- =========================================================

-- PASO 1: CREAR SOLO LA TABLA PRINCIPAL
CREATE TABLE IF NOT EXISTS purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    final_amount_hnld DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_details JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'agreement_confirmed', 'payment_in_progress', 
        'payment_verified', 'funds_released', 'completed', 
        'cancelled', 'disputed'
    )),
    payment_deadline TIMESTAMP WITH TIME ZONE,
    verification_deadline TIMESTAMP WITH TIME ZONE,
    escrow_amount DECIMAL(15,2),
    escrow_status VARCHAR(20) DEFAULT 'protected' CHECK (escrow_status IN ('protected', 'released', 'refunded')),
    payment_proof_url TEXT,
    payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_self_transaction CHECK (buyer_id != seller_id),
    CONSTRAINT positive_amounts CHECK (amount > 0 AND final_amount_hnld > 0)
);

-- VERIFICAR QUE LA TABLA SE CREÓ
SELECT 'Tabla purchase_transactions creada' as resultado;

-- VERIFICAR QUE LA COLUMNA payment_deadline EXISTE
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchase_transactions' 
AND column_name = 'payment_deadline';

-- PASO 2: CREAR TABLA TRANSACTION_STEPS
CREATE TABLE IF NOT EXISTS transaction_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL,
    step_order INTEGER NOT NULL,
    step_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_step_per_transaction UNIQUE (transaction_id, step_order)
);

SELECT 'Tabla transaction_steps creada' as resultado;

-- PASO 3: CREAR TABLA TRANSACTION_DOCUMENTS
CREATE TABLE IF NOT EXISTS transaction_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('payment_proof', 'receipt', 'invoice', 'contract', 'other')),
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Tabla transaction_documents creada' as resultado;

-- PASO 4: CREAR TABLA TRANSACTION_NOTIFICATIONS
CREATE TABLE IF NOT EXISTS transaction_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'payment_deadline_warning', 'payment_received', 'payment_verified', 
        'funds_released', 'transaction_completed', 'transaction_cancelled', 
        'dispute_opened', 'document_uploaded', 'step_completed'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Tabla transaction_notifications creada' as resultado;

-- PASO 5: CREAR TABLA TRANSACTION_DISPUTES
CREATE TABLE IF NOT EXISTS transaction_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    dispute_reason VARCHAR(100) NOT NULL,
    dispute_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolution_type VARCHAR(50) CHECK (resolution_type IN ('refund_buyer', 'pay_seller', 'partial_refund', 'no_action')),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Tabla transaction_disputes creada' as resultado;

-- PASO 6: CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_request_id ON purchase_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_buyer_id ON purchase_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_seller_id ON purchase_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status ON purchase_transactions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_payment_deadline ON purchase_transactions(payment_deadline);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_created_at ON purchase_transactions(created_at DESC);

SELECT 'Índices creados' as resultado;

-- PASO 7: CREAR FUNCIÓN VALIDATE_STATUS_TRANSITION
CREATE OR REPLACE FUNCTION validate_status_transition(
    p_current_status VARCHAR(30),
    p_new_status VARCHAR(30)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_current_status
        WHEN 'pending' THEN RETURN p_new_status IN ('agreement_confirmed', 'cancelled');
        WHEN 'agreement_confirmed' THEN RETURN p_new_status IN ('payment_in_progress', 'cancelled');
        WHEN 'payment_in_progress' THEN RETURN p_new_status IN ('payment_verified', 'cancelled', 'disputed');
        WHEN 'payment_verified' THEN RETURN p_new_status IN ('funds_released', 'disputed');
        WHEN 'funds_released' THEN RETURN p_new_status IN ('completed', 'disputed');
        WHEN 'completed' THEN RETURN FALSE;
        WHEN 'cancelled' THEN RETURN FALSE;
        WHEN 'disputed' THEN RETURN p_new_status IN ('completed', 'cancelled');
        ELSE RETURN FALSE;
    END CASE;
END;
$$;

SELECT 'Función validate_status_transition creada' as resultado;

-- PASO 8: CREAR FUNCIÓN CREATE_PURCHASE_TRANSACTION
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
    SELECT * INTO v_request_data FROM purchase_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    IF v_request_data.status != 'active' THEN
        RAISE EXCEPTION 'La solicitud no está disponible para transacción';
    END IF;
    
    IF v_request_data.buyer_id = p_seller_id THEN
        RAISE EXCEPTION 'No puedes comprar tu propia solicitud';
    END IF;
    
    v_payment_deadline := NOW() + INTERVAL '24 hours';
    
    INSERT INTO purchase_transactions (
        id, request_id, buyer_id, seller_id, amount, currency, exchange_rate,
        final_amount_hnld, payment_method, payment_details, status,
        payment_deadline, escrow_amount, escrow_status,
        terms_accepted_at, agreement_confirmed_at, created_at, updated_at
    ) VALUES (
        v_transaction_id, p_request_id, v_request_data.buyer_id, p_seller_id,
        v_request_data.amount, COALESCE(v_request_data.currency_type, 'USD'),
        COALESCE(v_request_data.exchange_rate, 1.0), v_request_data.amount,
        p_payment_method, p_payment_details, 'agreement_confirmed',
        v_payment_deadline, v_request_data.amount, 'protected',
        NOW(), NOW(), NOW(), NOW()
    );
    
    INSERT INTO transaction_steps (transaction_id, step_name, step_order, step_description, status, created_at, updated_at) VALUES
    (v_transaction_id, 'confirm_agreement', 1, 'Verificar el importe y el método de pago', 'completed', NOW(), NOW()),
    (v_transaction_id, 'payment_in_progress', 2, 'Realizar el pago antes de que expire el temporizador', 'in_progress', NOW(), NOW()),
    (v_transaction_id, 'verify_receipt', 3, 'Verificar el comprobante de pago', 'pending', NOW(), NOW()),
    (v_transaction_id, 'release_funds', 4, 'Liberar los fondos al vendedor', 'pending', NOW(), NOW());
    
    UPDATE purchase_requests 
    SET status = 'accepted', seller_id = p_seller_id, accepted_at = NOW(), updated_at = NOW()
    WHERE id = p_request_id;
    
    INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at) VALUES
    (v_transaction_id, v_request_data.buyer_id, 'payment_deadline_warning', 'Pago pendiente', 'Tienes 24 horas para completar el pago', NOW()),
    (v_transaction_id, p_seller_id, 'payment_received', 'Transacción iniciada', 'El comprador ha confirmado la transacción', NOW());
    
    RETURN v_transaction_id;
END;
$$;

SELECT 'Función create_purchase_transaction creada' as resultado;

-- PASO 9: CREAR FUNCIÓN UPDATE_TRANSACTION_STATUS
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
BEGIN
    SELECT status INTO v_current_status FROM purchase_transactions WHERE id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción no encontrada';
    END IF;
    
    IF NOT validate_status_transition(v_current_status, p_new_status) THEN
        RAISE EXCEPTION 'Transición de estado no válida: % -> %', v_current_status, p_new_status;
    END IF;
    
    UPDATE purchase_transactions SET status = p_new_status, updated_at = NOW() WHERE id = p_transaction_id;
    
    UPDATE transaction_steps SET 
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

SELECT 'Función update_transaction_status creada' as resultado;

-- PASO 10: CREAR FUNCIÓN CLEANUP_EXPIRED_TRANSACTIONS
CREATE OR REPLACE FUNCTION cleanup_expired_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE purchase_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE status = 'payment_in_progress'
    AND payment_deadline < NOW()
    AND payment_deadline IS NOT NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    IF v_count > 0 THEN
        INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at)
        SELECT pt.id, pt.buyer_id, 'transaction_cancelled', 'Transacción cancelada', 'La transacción fue cancelada por tiempo vencido', NOW()
        FROM purchase_transactions pt
        WHERE pt.status = 'cancelled' AND pt.updated_at > NOW() - INTERVAL '1 minute';
        
        INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at)
        SELECT pt.id, pt.seller_id, 'transaction_cancelled', 'Transacción cancelada', 'La transacción fue cancelada por tiempo vencido', NOW()
        FROM purchase_transactions pt
        WHERE pt.status = 'cancelled' AND pt.updated_at > NOW() - INTERVAL '1 minute';
    END IF;
    
    RETURN v_count;
END;
$$;

SELECT 'Función cleanup_expired_transactions creada' as resultado;

-- PASO 11: CREAR TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_purchase_transactions_updated_at
    BEFORE UPDATE ON purchase_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_steps_updated_at
    BEFORE UPDATE ON transaction_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_disputes_updated_at
    BEFORE UPDATE ON transaction_disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'Triggers creados' as resultado;

-- PASO 12: CONFIGURAR RLS
ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their transactions" ON purchase_transactions
    FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create transactions" ON purchase_transactions
    FOR INSERT WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can update their transactions" ON purchase_transactions
    FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can view transaction steps" ON transaction_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can view transaction documents" ON transaction_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can upload documents" ON transaction_documents
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can view their notifications" ON transaction_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON transaction_notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view transaction disputes" ON transaction_disputes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can create disputes" ON transaction_disputes
    FOR INSERT WITH CHECK (
        opened_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

SELECT 'RLS configurado' as resultado;

-- PASO 13: VERIFICACIÓN FINAL
SELECT 'Tablas creadas' as tipo, COUNT(*) as cantidad
FROM information_schema.tables 
WHERE table_name IN ('purchase_transactions', 'transaction_steps', 'transaction_documents', 'transaction_notifications', 'transaction_disputes')
AND table_schema = 'public';

SELECT 'Funciones creadas' as tipo, COUNT(*) as cantidad
FROM pg_proc 
WHERE proname IN ('create_purchase_transaction', 'update_transaction_status', 'validate_status_transition', 'cleanup_expired_transactions')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_transactions' 
AND column_name = 'payment_deadline';

SELECT '¡SISTEMA COMPLETO Y FUNCIONAL!' as resultado;

-- =========================================================
-- SCRIPT COMPLETO PARA CREAR EL SISTEMA DE COMPLETAR COMPRA
-- =========================================================
-- Este script ejecuta todo en el orden correcto para evitar errores
-- =========================================================

-- =========================================================
-- PASO 1: CREAR LAS TABLAS PRINCIPALES
-- =========================================================

-- Tabla de transacciones de compra
CREATE TABLE IF NOT EXISTS purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencia a la solicitud original
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    
    -- Participantes
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Detalles de la transacción
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    final_amount_hnld DECIMAL(15,2) NOT NULL,
    
    -- Método de pago acordado
    payment_method VARCHAR(50) NOT NULL,
    payment_details JSONB, -- Detalles específicos del método de pago
    
    -- Estado de la transacción
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Pendiente de confirmación
        'agreement_confirmed', -- Acuerdo confirmado
        'payment_in_progress', -- Pago en proceso
        'payment_verified',   -- Pago verificado
        'funds_released',     -- Fondos liberados
        'completed',          -- Completada
        'cancelled',          -- Cancelada
        'disputed'            -- En disputa
    )),
    
    -- Temporizadores
    payment_deadline TIMESTAMP WITH TIME ZONE,
    verification_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Fondos en custodia (escrow)
    escrow_amount DECIMAL(15,2),
    escrow_status VARCHAR(20) DEFAULT 'protected' CHECK (escrow_status IN ('protected', 'released', 'refunded')),
    
    -- Comprobantes y documentos
    payment_proof_url TEXT,
    payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadatos
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_transaction CHECK (buyer_id != seller_id),
    CONSTRAINT positive_amounts CHECK (amount > 0 AND final_amount_hnld > 0)
);

-- Tabla de pasos de transacción
CREATE TABLE IF NOT EXISTS transaction_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    
    -- Información del paso
    step_name VARCHAR(50) NOT NULL,
    step_order INTEGER NOT NULL,
    step_description TEXT,
    
    -- Estado del paso
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    
    -- Metadatos
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para pasos únicos por transacción
    CONSTRAINT unique_step_per_transaction UNIQUE (transaction_id, step_order)
);

-- Tabla de documentos de transacción
CREATE TABLE IF NOT EXISTS transaction_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    
    -- Información del documento
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'payment_proof',     -- Comprobante de pago
        'receipt',           -- Recibo
        'invoice',           -- Factura
        'contract',          -- Contrato
        'other'              -- Otro
    )),
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- Metadatos
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones de transacción
CREATE TABLE IF NOT EXISTS transaction_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    
    -- Información de la notificación
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'payment_deadline_warning',  -- Advertencia de deadline de pago
        'payment_received',          -- Pago recibido
        'payment_verified',          -- Pago verificado
        'funds_released',            -- Fondos liberados
        'transaction_completed',     -- Transacción completada
        'transaction_cancelled',     -- Transacción cancelada
        'dispute_opened',            -- Disputa abierta
        'document_uploaded',         -- Documento subido
        'step_completed'             -- Paso completado
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Estado
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de disputas de transacción
CREATE TABLE IF NOT EXISTS transaction_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    
    -- Información de la disputa
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    dispute_reason VARCHAR(100) NOT NULL,
    dispute_description TEXT NOT NULL,
    
    -- Estado de la disputa
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    
    -- Resolución
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolution_type VARCHAR(50) CHECK (resolution_type IN ('refund_buyer', 'pay_seller', 'partial_refund', 'no_action')),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- PASO 2: CREAR ÍNDICES
-- =========================================================

-- Índices para purchase_transactions
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_request_id ON purchase_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_buyer_id ON purchase_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_seller_id ON purchase_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status ON purchase_transactions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_payment_deadline ON purchase_transactions(payment_deadline);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_created_at ON purchase_transactions(created_at DESC);

-- Índices para transaction_steps
CREATE INDEX IF NOT EXISTS idx_transaction_steps_transaction_id ON transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_steps_status ON transaction_steps(status);

-- Índices para transaction_documents
CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_documents_uploaded_by ON transaction_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_transaction_documents_document_type ON transaction_documents(document_type);

-- Índices para transaction_notifications
CREATE INDEX IF NOT EXISTS idx_transaction_notifications_transaction_id ON transaction_notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_notifications_user_id ON transaction_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_notifications_is_read ON transaction_notifications(is_read);

-- Índices para transaction_disputes
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_transaction_id ON transaction_disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_opened_by ON transaction_disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_status ON transaction_disputes(status);

-- =========================================================
-- PASO 3: CREAR FUNCIONES
-- =========================================================

-- Función para validar transiciones de estado
CREATE OR REPLACE FUNCTION validate_status_transition(
    p_current_status VARCHAR(30),
    p_new_status VARCHAR(30)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Definir transiciones válidas
    CASE p_current_status
        WHEN 'pending' THEN
            RETURN p_new_status IN ('agreement_confirmed', 'cancelled');
        WHEN 'agreement_confirmed' THEN
            RETURN p_new_status IN ('payment_in_progress', 'cancelled');
        WHEN 'payment_in_progress' THEN
            RETURN p_new_status IN ('payment_verified', 'cancelled', 'disputed');
        WHEN 'payment_verified' THEN
            RETURN p_new_status IN ('funds_released', 'disputed');
        WHEN 'funds_released' THEN
            RETURN p_new_status IN ('completed', 'disputed');
        WHEN 'completed' THEN
            RETURN FALSE; -- Estado final
        WHEN 'cancelled' THEN
            RETURN FALSE; -- Estado final
        WHEN 'disputed' THEN
            RETURN p_new_status IN ('completed', 'cancelled');
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

-- Función para crear una transacción desde una solicitud
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

-- Función para actualizar el estado de una transacción
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

-- Función para limpiar transacciones expiradas
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
        INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at)
        SELECT 
            pt.id,
            pt.buyer_id,
            'transaction_cancelled',
            'Transacción cancelada',
            'La transacción fue cancelada por tiempo vencido',
            NOW()
        FROM purchase_transactions pt
        WHERE pt.status = 'cancelled'
        AND pt.updated_at > NOW() - INTERVAL '1 minute';
        
        INSERT INTO transaction_notifications (transaction_id, user_id, notification_type, title, message, created_at)
        SELECT 
            pt.id,
            pt.seller_id,
            'transaction_cancelled',
            'Transacción cancelada',
            'La transacción fue cancelada por tiempo vencido',
            NOW()
        FROM purchase_transactions pt
        WHERE pt.status = 'cancelled'
        AND pt.updated_at > NOW() - INTERVAL '1 minute';
    END IF;
    
    RETURN v_count;
END;
$$;

-- =========================================================
-- PASO 4: CREAR TRIGGERS
-- =========================================================

-- Trigger para actualizar updated_at
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

-- =========================================================
-- PASO 5: CONFIGURAR RLS
-- =========================================================

-- Habilitar RLS
ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_disputes ENABLE ROW LEVEL SECURITY;

-- Políticas para purchase_transactions
CREATE POLICY "Users can view their transactions" ON purchase_transactions
    FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create transactions" ON purchase_transactions
    FOR INSERT WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can update their transactions" ON purchase_transactions
    FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Políticas para transaction_steps
CREATE POLICY "Users can view transaction steps" ON transaction_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

-- Políticas para transaction_documents
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

-- Políticas para transaction_notifications
CREATE POLICY "Users can view their notifications" ON transaction_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON transaction_notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Políticas para transaction_disputes
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

-- =========================================================
-- PASO 6: COMENTARIOS Y DOCUMENTACIÓN
-- =========================================================

COMMENT ON TABLE purchase_transactions IS 'Transacciones de compra con flujo completo y protección de fondos';
COMMENT ON TABLE transaction_steps IS 'Pasos individuales de cada transacción';
COMMENT ON TABLE transaction_documents IS 'Documentos subidos durante las transacciones';
COMMENT ON TABLE transaction_notifications IS 'Notificaciones relacionadas con transacciones';
COMMENT ON TABLE transaction_disputes IS 'Disputas y resolución de conflictos';

COMMENT ON FUNCTION create_purchase_transaction IS 'Crea una nueva transacción desde una solicitud de compra';
COMMENT ON FUNCTION update_transaction_status IS 'Actualiza el estado de una transacción validando transiciones';
COMMENT ON FUNCTION validate_status_transition IS 'Valida si una transición de estado es permitida';
COMMENT ON FUNCTION cleanup_expired_transactions IS 'Cancela transacciones con pago vencido y crea notificaciones';

-- =========================================================
-- PASO 7: VERIFICACIÓN FINAL
-- =========================================================

-- Verificar que todas las tablas se crearon
SELECT 
    'Tablas creadas' as tipo,
    COUNT(*) as cantidad
FROM information_schema.tables 
WHERE table_name IN ('purchase_transactions', 'transaction_steps', 'transaction_documents', 'transaction_notifications', 'transaction_disputes');

-- Verificar que todas las funciones se crearon
SELECT 
    'Funciones creadas' as tipo,
    COUNT(*) as cantidad
FROM pg_proc 
WHERE proname IN ('create_purchase_transaction', 'update_transaction_status', 'validate_status_transition', 'cleanup_expired_transactions');

-- Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('purchase_transactions', 'transaction_steps', 'transaction_documents', 'transaction_notifications', 'transaction_disputes')
AND schemaname = 'public';

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Este script crea todo el sistema en el orden correcto
-- 2. Evita errores de dependencias
-- 3. Incluye verificaciones de integridad
-- 4. Configura RLS para seguridad
-- 5. Crea todas las funciones necesarias
-- 6. Incluye triggers para automatización
-- =========================================================

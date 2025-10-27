-- =========================================================
-- VERIFICACIÓN DEL PROBLEMA EN EL PASO 8
-- =========================================================
-- Ejecuta estos comandos para ver qué está pasando
-- =========================================================

-- 1. Verificar si la tabla purchase_transactions existe
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'purchase_transactions';

-- 2. Verificar todas las columnas de la tabla purchase_transactions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_transactions' 
ORDER BY ordinal_position;

-- 3. Verificar si hay algún error en la creación de la tabla
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename = 'purchase_transactions';

-- 4. Verificar si hay constraints que fallaron
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid)
FROM pg_constraint 
WHERE conrelid = 'purchase_transactions'::regclass;

-- =========================================================
-- SOLUCIÓN: RECREAR LA TABLA CORRECTAMENTE
-- =========================================================

-- Si la tabla existe pero no tiene la columna payment_deadline, elimínala y créala de nuevo
DROP TABLE IF EXISTS purchase_transactions CASCADE;

-- Crear la tabla de nuevo con la sintaxis correcta
CREATE TABLE purchase_transactions (
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
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_deadline TIMESTAMP WITH TIME ZONE,
    verification_deadline TIMESTAMP WITH TIME ZONE,
    escrow_amount DECIMAL(15,2),
    escrow_status VARCHAR(20) DEFAULT 'protected',
    payment_proof_url TEXT,
    payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar constraints después de crear la tabla
ALTER TABLE purchase_transactions 
ADD CONSTRAINT purchase_transactions_status_check 
CHECK (status IN ('pending', 'agreement_confirmed', 'payment_in_progress', 'payment_verified', 'funds_released', 'completed', 'cancelled', 'disputed'));

ALTER TABLE purchase_transactions 
ADD CONSTRAINT purchase_transactions_escrow_status_check 
CHECK (escrow_status IN ('protected', 'released', 'refunded'));

ALTER TABLE purchase_transactions 
ADD CONSTRAINT no_self_transaction 
CHECK (buyer_id != seller_id);

ALTER TABLE purchase_transactions 
ADD CONSTRAINT positive_amounts 
CHECK (amount > 0 AND final_amount_hnld > 0);

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla purchase_transactions recreada correctamente' as resultado;

-- Verificar que la columna payment_deadline existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_transactions' 
AND column_name = 'payment_deadline';

-- =========================================================
-- AHORA CREAR LOS ÍNDICES (PASO 8 CORREGIDO)
-- =========================================================

-- Crear índices uno por uno para identificar cuál falla
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_request_id ON purchase_transactions(request_id);
SELECT 'Índice request_id creado' as resultado;

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_buyer_id ON purchase_transactions(buyer_id);
SELECT 'Índice buyer_id creado' as resultado;

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_seller_id ON purchase_transactions(seller_id);
SELECT 'Índice seller_id creado' as resultado;

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status ON purchase_transactions(status);
SELECT 'Índice status creado' as resultado;

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_payment_deadline ON purchase_transactions(payment_deadline);
SELECT 'Índice payment_deadline creado' as resultado;

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_created_at ON purchase_transactions(created_at DESC);
SELECT 'Índice created_at creado' as resultado;

-- =========================================================
-- CONTINUAR CON EL RESTO DE TABLAS
-- =========================================================

-- Crear tabla transaction_steps
CREATE TABLE IF NOT EXISTS transaction_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL,
    step_order INTEGER NOT NULL,
    step_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar constraint después de crear la tabla
ALTER TABLE transaction_steps 
ADD CONSTRAINT transaction_steps_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'));

ALTER TABLE transaction_steps 
ADD CONSTRAINT unique_step_per_transaction 
UNIQUE (transaction_id, step_order);

SELECT 'Tabla transaction_steps creada' as resultado;

-- Crear tabla transaction_documents
CREATE TABLE IF NOT EXISTS transaction_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
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

-- Agregar constraint después de crear la tabla
ALTER TABLE transaction_documents 
ADD CONSTRAINT transaction_documents_document_type_check 
CHECK (document_type IN ('payment_proof', 'receipt', 'invoice', 'contract', 'other'));

SELECT 'Tabla transaction_documents creada' as resultado;

-- Crear tabla transaction_notifications
CREATE TABLE IF NOT EXISTS transaction_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar constraint después de crear la tabla
ALTER TABLE transaction_notifications 
ADD CONSTRAINT transaction_notifications_notification_type_check 
CHECK (notification_type IN ('payment_deadline_warning', 'payment_received', 'payment_verified', 'funds_released', 'transaction_completed', 'transaction_cancelled', 'dispute_opened', 'document_uploaded', 'step_completed'));

SELECT 'Tabla transaction_notifications creada' as resultado;

-- Crear tabla transaction_disputes
CREATE TABLE IF NOT EXISTS transaction_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    dispute_reason VARCHAR(100) NOT NULL,
    dispute_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolution_type VARCHAR(50),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar constraints después de crear la tabla
ALTER TABLE transaction_disputes 
ADD CONSTRAINT transaction_disputes_status_check 
CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed'));

ALTER TABLE transaction_disputes 
ADD CONSTRAINT transaction_disputes_resolution_type_check 
CHECK (resolution_type IN ('refund_buyer', 'pay_seller', 'partial_refund', 'no_action'));

SELECT 'Tabla transaction_disputes creada' as resultado;

-- =========================================================
-- VERIFICACIÓN FINAL
-- =========================================================

-- Verificar que todas las tablas se crearon
SELECT 'Tablas creadas' as tipo, COUNT(*) as cantidad
FROM information_schema.tables 
WHERE table_name IN ('purchase_transactions', 'transaction_steps', 'transaction_documents', 'transaction_notifications', 'transaction_disputes')
AND table_schema = 'public';

-- Verificar que la columna payment_deadline existe
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_transactions' 
AND column_name = 'payment_deadline';

-- Verificar que los índices se crearon
SELECT indexname, tablename, indexdef
FROM pg_indexes 
WHERE tablename = 'purchase_transactions' 
AND indexname LIKE 'idx_purchase_transactions_%';

SELECT '¡SISTEMA CREADO CORRECTAMENTE!' as resultado;

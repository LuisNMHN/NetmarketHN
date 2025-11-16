-- =========================================================
-- SISTEMA DE SOLICITUDES DE VENTA DE HNLD
-- =========================================================
-- Sistema complementario al de compra - Permite a usuarios vender HNLD
-- El vendedor especifica cuánto HNLD quiere vender y cómo quiere recibir el pago
-- =========================================================

-- 1. Tabla de solicitudes de venta
CREATE TABLE IF NOT EXISTS sale_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la solicitud
    amount DECIMAL(15,2) NOT NULL, -- Cantidad de HNLD que quiere vender
    currency VARCHAR(10) NOT NULL DEFAULT 'HNLD',
    description TEXT,
    
    -- Estado de la solicitud
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'negotiating', 'accepted', 'completed', 'cancelled', 'expired')),
    
    -- Información del comprador (cuando se acepta)
    buyer_id UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Método de pago que el vendedor quiere recibir
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('local_transfer', 'international_transfer', 'card', 'digital_balance', 'cash')),
    
    -- Detalles del método de pago
    bank_name VARCHAR(255),
    custom_bank_name VARCHAR(255),
    country VARCHAR(100),
    custom_country VARCHAR(255),
    digital_wallet VARCHAR(50) CHECK (digital_wallet IN ('PayPal', 'Skrill', 'Payoneer')),
    
    -- Información de conversión de moneda (si aplica)
    currency_type VARCHAR(10) NOT NULL DEFAULT 'L' CHECK (currency_type IN ('L', 'USD', 'EUR')),
    amount_in_original_currency DECIMAL(15,2), -- Monto en la moneda original que quiere recibir
    exchange_rate_applied DECIMAL(10,4) DEFAULT 1.0000,
    final_amount_hnld DECIMAL(15,2) NOT NULL, -- Monto final en HNLD que se venderá
    
    -- Código único de la solicitud
    unique_code VARCHAR(50) UNIQUE,
    
    -- Términos de la transacción
    terms TEXT,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Fechas importantes
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos
    metadata JSONB,
    
    -- Constraints
    CONSTRAINT positive_amount CHECK (amount > 0 AND final_amount_hnld > 0)
);

-- 2. Tabla de transacciones de venta
CREATE TABLE IF NOT EXISTS sale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES sale_requests(id) ON DELETE CASCADE,
    
    -- Participantes (invertido respecto a purchase)
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Vendedor de HNLD
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- Comprador de HNLD
    
    -- Detalles de la transacción
    amount DECIMAL(15,2) NOT NULL, -- Monto en moneda original que recibirá el vendedor
    currency VARCHAR(10) NOT NULL DEFAULT 'L',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    final_amount_hnld DECIMAL(15,2) NOT NULL, -- Cantidad de HNLD que se venderá
    
    -- Método de pago acordado
    payment_method VARCHAR(50) NOT NULL,
    payment_details JSONB,
    
    -- Estado de la transacción
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',              -- Pendiente de confirmación
        'agreement_confirmed',  -- Acuerdo confirmado (HNLD bloqueados en escrow)
        'payment_in_progress',  -- Pago en proceso
        'payment_verified',      -- Pago verificado
        'hnld_released',        -- HNLD liberados al comprador
        'completed',            -- Completada
        'cancelled',            -- Cancelada
        'disputed'              -- En disputa
    )),
    
    -- Temporizadores
    payment_deadline TIMESTAMP WITH TIME ZONE,
    verification_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Fondos en custodia (escrow) - HNLD del vendedor
    escrow_amount DECIMAL(15,2), -- Cantidad de HNLD bloqueada
    escrow_status VARCHAR(20) DEFAULT 'protected' CHECK (escrow_status IN ('protected', 'released', 'refunded')),
    
    -- Comprobantes y documentos
    payment_proof_url TEXT,
    payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    hnld_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadatos
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_sale_transaction CHECK (buyer_id != seller_id),
    CONSTRAINT positive_sale_amounts CHECK (amount > 0 AND final_amount_hnld > 0)
);

-- 3. Tabla de pasos de transacción de venta
CREATE TABLE IF NOT EXISTS sale_transaction_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
    
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
    CONSTRAINT unique_sale_step_per_transaction UNIQUE (transaction_id, step_order)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_created_at ON sale_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_requests_expires_at ON sale_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_sale_requests_unique_code ON sale_requests(unique_code);

CREATE INDEX IF NOT EXISTS idx_sale_transactions_request_id ON sale_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_seller_id ON sale_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_buyer_id ON sale_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_status ON sale_transactions(status);

CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_transaction_id ON sale_transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_step_order ON sale_transaction_steps(transaction_id, step_order);

-- RLS (Row Level Security)
ALTER TABLE sale_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transaction_steps ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can create own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can update own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Anyone can view active sale requests" ON sale_requests;

DROP POLICY IF EXISTS "Users can view own sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can create sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can update own sale transactions" ON sale_transactions;

DROP POLICY IF EXISTS "Users can view sale transaction steps" ON sale_transaction_steps;
DROP POLICY IF EXISTS "Users can update sale transaction steps" ON sale_transaction_steps;

-- Políticas RLS para sale_requests
CREATE POLICY "Users can view own sale requests" ON sale_requests
    FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Users can create own sale requests" ON sale_requests
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own sale requests" ON sale_requests
    FOR UPDATE USING (auth.uid() = seller_id);

-- Política para que todos puedan ver solicitudes activas (excepto el propio vendedor)
CREATE POLICY "Anyone can view active sale requests" ON sale_requests
    FOR SELECT USING (status = 'active' AND auth.uid() != seller_id);

-- Políticas RLS para sale_transactions
CREATE POLICY "Users can view own sale transactions" ON sale_transactions
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create sale transactions" ON sale_transactions
    FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update own sale transactions" ON sale_transactions
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Políticas RLS para sale_transaction_steps
CREATE POLICY "Users can view sale transaction steps" ON sale_transaction_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can update sale transaction steps" ON sale_transaction_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
        )
    );

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_sale_requests_updated_at 
    BEFORE UPDATE ON sale_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sale_transactions_updated_at 
    BEFORE UPDATE ON sale_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sale_transaction_steps_updated_at 
    BEFORE UPDATE ON sale_transaction_steps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE sale_requests IS 'Solicitudes de venta de HNLD - Permite a usuarios vender HNLD por dinero real';
COMMENT ON TABLE sale_transactions IS 'Transacciones completadas de venta de HNLD';
COMMENT ON TABLE sale_transaction_steps IS 'Pasos de las transacciones de venta';


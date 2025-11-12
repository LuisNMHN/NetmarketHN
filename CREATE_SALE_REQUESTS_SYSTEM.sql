-- =========================================================
-- SISTEMA DE SOLICITUDES DE VENTA HNLD
-- =========================================================
-- Sistema paralelo al de compras para permitir a usuarios
-- vender sus HNLD y recibir dinero físico
-- =========================================================

-- =========================================================
-- 1. TABLA DE SOLICITUDES DE VENTA
-- =========================================================

CREATE TABLE IF NOT EXISTS sale_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la solicitud
    amount DECIMAL(15,2) NOT NULL, -- Monto en HNLD que se quiere vender
    currency VARCHAR(10) NOT NULL DEFAULT 'HNLD',
    description TEXT,
    
    -- Estado de la solicitud
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'negotiating', 'accepted', 'completed', 'cancelled', 'expired')),
    
    -- Información del comprador (cuando se acepta)
    buyer_id UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Términos de la transacción
    terms TEXT,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Método de pago que el vendedor quiere recibir
    payment_method VARCHAR(50) CHECK (payment_method IN ('local_transfer', 'international_transfer', 'card', 'digital_balance', 'cash')),
    bank_name VARCHAR(100),
    custom_bank_name VARCHAR(100),
    country VARCHAR(100),
    custom_country VARCHAR(100),
    digital_wallet VARCHAR(50) CHECK (digital_wallet IN ('PayPal', 'Skrill', 'Payoneer')),
    
    -- Información de moneda y conversión
    currency_type VARCHAR(10) CHECK (currency_type IN ('L', 'USD', 'EUR')) DEFAULT 'L',
    amount_in_original_currency DECIMAL(15,2), -- Monto en moneda original que quiere recibir
    exchange_rate_applied DECIMAL(10,4) DEFAULT 1.0000,
    processing_fee_percentage DECIMAL(5,2),
    processing_fee_amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2) NOT NULL, -- Monto en HNLD que se venderá
    
    -- Referencia de pago
    payment_reference TEXT,
    payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Código único de la solicitud
    unique_code VARCHAR(50) UNIQUE,
    
    -- Fechas importantes
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos
    metadata JSONB
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_unique_code ON sale_requests(unique_code);
CREATE INDEX IF NOT EXISTS idx_sale_requests_expires_at ON sale_requests(expires_at);

-- =========================================================
-- 2. TABLA DE TRANSACCIONES DE VENTA
-- =========================================================

CREATE TABLE IF NOT EXISTS sale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencia a la solicitud original
    request_id UUID NOT NULL REFERENCES sale_requests(id) ON DELETE CASCADE,
    
    -- Participantes (roles invertidos respecto a compras)
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Vendedor de HNLD
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Comprador de HNLD
    
    -- Detalles de la transacción
    amount DECIMAL(15,2) NOT NULL, -- Monto en moneda física que recibirá el vendedor
    currency VARCHAR(10) NOT NULL DEFAULT 'L',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    hnld_amount DECIMAL(15,2) NOT NULL, -- Monto en HNLD que se vende
    
    -- Método de pago acordado
    payment_method VARCHAR(50) NOT NULL,
    payment_details JSONB,
    
    -- Estado de la transacción
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Pendiente de confirmación
        'agreement_confirmed', -- Acuerdo confirmado
        'payment_in_progress', -- Pago en proceso
        'payment_verified',   -- Pago verificado
        'hnld_released',     -- HNLD liberados al comprador
        'completed',          -- Completada
        'cancelled',          -- Cancelada
        'disputed'            -- En disputa
    )),
    
    -- Temporizadores
    payment_deadline TIMESTAMP WITH TIME ZONE,
    verification_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Fondos en custodia (escrow) - HNLD bloqueados
    escrow_amount DECIMAL(15,2), -- Monto en HNLD en escrow
    escrow_status VARCHAR(20) DEFAULT 'protected' CHECK (escrow_status IN ('protected', 'released', 'refunded')),
    
    -- Comprobantes y documentos
    payment_proof_url TEXT,
    payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    hnld_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas de aceptación y términos
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_started_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT no_self_sale_transaction CHECK (seller_id != buyer_id),
    CONSTRAINT positive_sale_amounts CHECK (amount > 0 AND hnld_amount > 0)
);

-- Índices para transacciones de venta
CREATE INDEX IF NOT EXISTS idx_sale_transactions_request_id ON sale_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_seller_id ON sale_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_buyer_id ON sale_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_status ON sale_transactions(status);

-- =========================================================
-- 3. TABLA DE PASOS DE TRANSACCIÓN DE VENTA
-- =========================================================

CREATE TABLE IF NOT EXISTS sale_transaction_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL CHECK (step_order BETWEEN 1 AND 4),
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(transaction_id, step_order)
);

-- Índices para pasos de transacción de venta
CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_transaction_id ON sale_transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_status ON sale_transaction_steps(status);

-- =========================================================
-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- =========================================================

COMMENT ON TABLE sale_requests IS 'Solicitudes de usuarios para vender HNLD y recibir dinero físico';
COMMENT ON TABLE sale_transactions IS 'Transacciones completadas de venta de HNLD';
COMMENT ON TABLE sale_transaction_steps IS 'Pasos del proceso de completar una venta de HNLD';

COMMENT ON COLUMN sale_requests.seller_id IS 'Usuario que quiere vender HNLD';
COMMENT ON COLUMN sale_requests.buyer_id IS 'Usuario que compra HNLD (se asigna cuando se acepta)';
COMMENT ON COLUMN sale_requests.final_amount_hnld IS 'Cantidad de HNLD que se venderá';
COMMENT ON COLUMN sale_requests.amount_in_original_currency IS 'Monto en moneda física que el vendedor quiere recibir';

COMMENT ON COLUMN sale_transactions.seller_id IS 'Vendedor de HNLD (quien entrega HNLD)';
COMMENT ON COLUMN sale_transactions.buyer_id IS 'Comprador de HNLD (quien paga dinero físico)';
COMMENT ON COLUMN sale_transactions.amount IS 'Monto en moneda física que recibirá el vendedor';
COMMENT ON COLUMN sale_transactions.hnld_amount IS 'Cantidad de HNLD que se vende';
COMMENT ON COLUMN sale_transactions.escrow_amount IS 'HNLD bloqueados en escrow hasta confirmación de pago';


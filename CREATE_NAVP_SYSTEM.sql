-- Sistema NAVP (Network for Automated Value Payments)
-- OID/STC + OCR simple para validación de pagos por link/QR

-- 1. Tabla de códigos OID (Originator ID)
CREATE TABLE IF NOT EXISTS navp_oids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oid_code VARCHAR(20) NOT NULL UNIQUE,
    oid_name VARCHAR(100) NOT NULL,
    oid_type VARCHAR(50) NOT NULL CHECK (oid_type IN ('bank', 'fintech', 'merchant', 'individual')),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de códigos STC (Service Transaction Code)
CREATE TABLE IF NOT EXISTS navp_stcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stc_code VARCHAR(10) NOT NULL UNIQUE,
    stc_name VARCHAR(100) NOT NULL,
    stc_type VARCHAR(50) NOT NULL CHECK (stc_type IN ('payment', 'transfer', 'withdrawal', 'deposit', 'refund')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de pagos NAVP
CREATE TABLE IF NOT EXISTS navp_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_code VARCHAR(50) NOT NULL UNIQUE, -- Código único del pago
    oid_id UUID NOT NULL REFERENCES navp_oids(id) ON DELETE CASCADE,
    stc_id UUID NOT NULL REFERENCES navp_stcs(id) ON DELETE CASCADE,
    
    -- Información del pago
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'HNLD',
    description TEXT,
    
    -- Estados del pago
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
    
    -- Información del pagador (opcional para pagos anónimos)
    payer_id UUID REFERENCES auth.users(id),
    payer_email VARCHAR(255),
    payer_phone VARCHAR(20),
    
    -- Información del beneficiario
    payee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Códigos QR y Links
    qr_code_data TEXT, -- Datos del código QR
    payment_link TEXT, -- Link de pago
    qr_image_url TEXT, -- URL de la imagen QR generada
    
    -- Fechas importantes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadatos adicionales
    metadata JSONB,
    ocr_data JSONB, -- Datos extraídos por OCR
    
    -- Referencias a transacciones
    hnld_transaction_id UUID REFERENCES hnld_transactions(id),
    escrow_id UUID REFERENCES escrows(id)
);

-- 4. Tabla de escaneos OCR
CREATE TABLE IF NOT EXISTS navp_ocr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES navp_payments(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('qr', 'text', 'image')),
    scan_data TEXT NOT NULL, -- Datos escaneados
    extracted_data JSONB, -- Datos extraídos
    confidence_score DECIMAL(3,2), -- Nivel de confianza (0.00 - 1.00)
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de validaciones de pago
CREATE TABLE IF NOT EXISTS navp_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES navp_payments(id) ON DELETE CASCADE,
    validation_type VARCHAR(50) NOT NULL CHECK (validation_type IN ('oid_check', 'stc_check', 'amount_check', 'expiry_check', 'ocr_validation')),
    validation_result BOOLEAN NOT NULL,
    validation_message TEXT,
    validated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabla de logs de procesamiento
CREATE TABLE IF NOT EXISTS navp_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES navp_payments(id) ON DELETE CASCADE,
    log_type VARCHAR(50) NOT NULL CHECK (log_type IN ('created', 'scanned', 'validated', 'processed', 'completed', 'failed')),
    log_message TEXT NOT NULL,
    log_data JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_navp_payments_payment_code ON navp_payments(payment_code);
CREATE INDEX IF NOT EXISTS idx_navp_payments_status ON navp_payments(status);
CREATE INDEX IF NOT EXISTS idx_navp_payments_created_at ON navp_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_navp_payments_expires_at ON navp_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_navp_payments_payee_id ON navp_payments(payee_id);
CREATE INDEX IF NOT EXISTS idx_navp_payments_payer_id ON navp_payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_navp_oids_oid_code ON navp_oids(oid_code);
CREATE INDEX IF NOT EXISTS idx_navp_stcs_stc_code ON navp_stcs(stc_code);
CREATE INDEX IF NOT EXISTS idx_navp_ocr_scans_payment_id ON navp_ocr_scans(payment_id);
CREATE INDEX IF NOT EXISTS idx_navp_validations_payment_id ON navp_validations(payment_id);

-- RLS (Row Level Security)
ALTER TABLE navp_oids ENABLE ROW LEVEL SECURITY;
ALTER TABLE navp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE navp_ocr_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE navp_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE navp_processing_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para navp_oids
CREATE POLICY "Users can view own OIDs" ON navp_oids
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own OIDs" ON navp_oids
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own OIDs" ON navp_oids
    FOR UPDATE USING (auth.uid() = owner_id);

-- Políticas RLS para navp_payments
CREATE POLICY "Users can view own payments" ON navp_payments
    FOR SELECT USING (auth.uid() = payee_id OR auth.uid() = payer_id);

CREATE POLICY "Users can create payments" ON navp_payments
    FOR INSERT WITH CHECK (auth.uid() = payee_id);

CREATE POLICY "Users can update own payments" ON navp_payments
    FOR UPDATE USING (auth.uid() = payee_id OR auth.uid() = payer_id);

-- Políticas RLS para navp_ocr_scans
CREATE POLICY "Users can view OCR scans" ON navp_ocr_scans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM navp_payments p 
            WHERE p.id = navp_ocr_scans.payment_id 
            AND (p.payee_id = auth.uid() OR p.payer_id = auth.uid())
        )
    );

CREATE POLICY "Users can create OCR scans" ON navp_ocr_scans
    FOR INSERT WITH CHECK (auth.uid() = processed_by);

-- Políticas RLS para navp_validations
CREATE POLICY "Users can view validations" ON navp_validations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM navp_payments p 
            WHERE p.id = navp_validations.payment_id 
            AND (p.payee_id = auth.uid() OR p.payer_id = auth.uid())
        )
    );

-- Políticas RLS para navp_processing_logs
CREATE POLICY "Users can view processing logs" ON navp_processing_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM navp_payments p 
            WHERE p.id = navp_processing_logs.payment_id 
            AND (p.payee_id = auth.uid() OR p.payer_id = auth.uid())
        )
    );

-- Función para generar código de pago único
CREATE OR REPLACE FUNCTION generate_payment_code()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_code VARCHAR(50);
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar código: NAVP + timestamp + random
        v_code := 'NAVP' || EXTRACT(EPOCH FROM NOW())::BIGINT || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
        
        -- Verificar que no exista
        SELECT EXISTS(SELECT 1 FROM navp_payments WHERE payment_code = v_code) INTO v_exists;
        
        IF NOT v_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Función para crear OID
CREATE OR REPLACE FUNCTION create_navp_oid(
    p_oid_code VARCHAR(20),
    p_oid_name VARCHAR(100),
    p_oid_type VARCHAR(50)
)
RETURNS UUID AS $$
DECLARE
    v_oid_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO navp_oids (id, oid_code, oid_name, oid_type, owner_id)
    VALUES (v_oid_id, p_oid_code, p_oid_name, p_oid_type, auth.uid());
    
    RETURN v_oid_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear pago NAVP
CREATE OR REPLACE FUNCTION create_navp_payment(
    p_oid_id UUID,
    p_stc_id UUID,
    p_amount DECIMAL(15,2),
    p_currency VARCHAR(10) DEFAULT 'HNLD',
    p_description TEXT DEFAULT NULL,
    p_payee_id UUID DEFAULT NULL,
    p_expires_in_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID := gen_random_uuid();
    v_payment_code VARCHAR(50);
    v_qr_data TEXT;
    v_payment_link TEXT;
BEGIN
    -- Generar código único
    v_payment_code := generate_payment_code();
    
    -- Usar payee_id por defecto si no se especifica
    IF p_payee_id IS NULL THEN
        p_payee_id := auth.uid();
    END IF;
    
    -- Generar datos QR
    v_qr_data := json_build_object(
        'payment_code', v_payment_code,
        'oid_id', p_oid_id,
        'stc_id', p_stc_id,
        'amount', p_amount,
        'currency', p_currency,
        'description', p_description,
        'created_at', NOW()
    )::TEXT;
    
    -- Generar link de pago
    v_payment_link := '/navp/pay/' || v_payment_code;
    
    -- Crear el pago
    INSERT INTO navp_payments (
        id, payment_code, oid_id, stc_id, amount, currency, description,
        payee_id, qr_code_data, payment_link, expires_at
    ) VALUES (
        v_payment_id, v_payment_code, p_oid_id, p_stc_id, p_amount, p_currency, p_description,
        p_payee_id, v_qr_data, v_payment_link, NOW() + (p_expires_in_hours || ' hours')::INTERVAL
    );
    
    -- Registrar log
    INSERT INTO navp_processing_logs (payment_id, log_type, log_message, created_by)
    VALUES (v_payment_id, 'created', 'Pago NAVP creado: ' || v_payment_code, auth.uid());
    
    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para procesar escaneo OCR
CREATE OR REPLACE FUNCTION process_ocr_scan(
    p_payment_id UUID,
    p_scan_type VARCHAR(20),
    p_scan_data TEXT,
    p_extracted_data JSONB DEFAULT NULL,
    p_confidence_score DECIMAL(3,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_scan_id UUID := gen_random_uuid();
BEGIN
    -- Insertar escaneo
    INSERT INTO navp_ocr_scans (
        id, payment_id, scan_type, scan_data, extracted_data, confidence_score, processed_by
    ) VALUES (
        v_scan_id, p_payment_id, p_scan_type, p_scan_data, p_extracted_data, p_confidence_score, auth.uid()
    );
    
    -- Registrar log
    INSERT INTO navp_processing_logs (payment_id, log_type, log_message, created_by)
    VALUES (p_payment_id, 'scanned', 'Escaneo OCR procesado: ' || p_scan_type, auth.uid());
    
    RETURN v_scan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar pago
CREATE OR REPLACE FUNCTION validate_navp_payment(
    p_payment_id UUID,
    p_validation_type VARCHAR(50),
    p_validation_result BOOLEAN,
    p_validation_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_validation_id UUID := gen_random_uuid();
    v_payment RECORD;
BEGIN
    -- Obtener información del pago
    SELECT * INTO v_payment FROM navp_payments WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    
    -- Insertar validación
    INSERT INTO navp_validations (
        id, payment_id, validation_type, validation_result, validation_message, validated_by
    ) VALUES (
        v_validation_id, p_payment_id, p_validation_type, p_validation_result, p_validation_message, auth.uid()
    );
    
    -- Registrar log
    INSERT INTO navp_processing_logs (payment_id, log_type, log_message, created_by)
    VALUES (p_payment_id, 'validated', 'Validación ' || p_validation_type || ': ' || p_validation_result, auth.uid());
    
    -- Si todas las validaciones son exitosas, procesar pago
    IF p_validation_result AND p_validation_type = 'ocr_validation' THEN
        -- Verificar que todas las validaciones sean exitosas
        IF NOT EXISTS (
            SELECT 1 FROM navp_validations 
            WHERE payment_id = p_payment_id AND validation_result = false
        ) THEN
            -- Procesar pago
            UPDATE navp_payments 
            SET status = 'processing', processed_at = NOW()
            WHERE id = p_payment_id;
            
            -- Registrar log
            INSERT INTO navp_processing_logs (payment_id, log_type, log_message, created_by)
            VALUES (p_payment_id, 'processed', 'Pago procesado automáticamente', auth.uid());
        END IF;
    END IF;
    
    RETURN v_validation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para completar pago
CREATE OR REPLACE FUNCTION complete_navp_payment(
    p_payment_id UUID,
    p_payer_id UUID DEFAULT NULL,
    p_payer_email VARCHAR(255) DEFAULT NULL,
    p_payer_phone VARCHAR(20) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payment RECORD;
    v_transaction_id UUID;
BEGIN
    -- Obtener información del pago
    SELECT * INTO v_payment FROM navp_payments WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    
    IF v_payment.status != 'processing' THEN
        RAISE EXCEPTION 'Pago no está en estado processing';
    END IF;
    
    -- Actualizar información del pagador
    UPDATE navp_payments 
    SET 
        payer_id = COALESCE(p_payer_id, v_payment.payer_id),
        payer_email = COALESCE(p_payer_email, v_payment.payer_email),
        payer_phone = COALESCE(p_payer_phone, v_payment.payer_phone),
        status = 'completed',
        completed_at = NOW()
    WHERE id = p_payment_id;
    
    -- Crear transacción HNLD si es necesario
    IF v_payment.currency = 'HNLD' AND p_payer_id IS NOT NULL THEN
        v_transaction_id := transfer_hnld(
            p_payer_id,
            v_payment.payee_id,
            v_payment.amount,
            'Pago NAVP: ' || v_payment.payment_code
        );
        
        -- Actualizar referencia de transacción
        UPDATE navp_payments 
        SET hnld_transaction_id = v_transaction_id
        WHERE id = p_payment_id;
    END IF;
    
    -- Registrar log
    INSERT INTO navp_processing_logs (payment_id, log_type, log_message, created_by)
    VALUES (p_payment_id, 'completed', 'Pago completado exitosamente', auth.uid());
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener pagos del usuario
CREATE OR REPLACE FUNCTION get_user_navp_payments(
    p_user_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    payment_code VARCHAR(50),
    amount DECIMAL(15,2),
    currency VARCHAR(10),
    status VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    qr_code_data TEXT,
    payment_link TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        np.id,
        np.payment_code,
        np.amount,
        np.currency,
        np.status,
        np.description,
        np.created_at,
        np.expires_at,
        np.completed_at,
        np.qr_code_data,
        np.payment_link
    FROM navp_payments np
    WHERE (np.payee_id = p_user_id OR np.payer_id = p_user_id)
    AND (p_status IS NULL OR np.status = p_status)
    ORDER BY np.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insertar STCs por defecto
INSERT INTO navp_stcs (stc_code, stc_name, stc_type, description) VALUES
('PAY001', 'Pago General', 'payment', 'Pago estándar entre usuarios'),
('TRF001', 'Transferencia', 'transfer', 'Transferencia de fondos'),
('WTH001', 'Retiro', 'withdrawal', 'Retiro de fondos'),
('DEP001', 'Depósito', 'deposit', 'Depósito de fondos'),
('REF001', 'Reembolso', 'refund', 'Reembolso de pago')
ON CONFLICT (stc_code) DO NOTHING;

-- Comentarios
COMMENT ON TABLE navp_oids IS 'Códigos OID (Originator ID) para identificación de pagadores';
COMMENT ON TABLE navp_stcs IS 'Códigos STC (Service Transaction Code) para tipos de transacción';
COMMENT ON TABLE navp_payments IS 'Pagos NAVP con códigos QR y links';
COMMENT ON TABLE navp_ocr_scans IS 'Escaneos OCR para procesamiento de códigos';
COMMENT ON TABLE navp_validations IS 'Validaciones de pagos NAVP';
COMMENT ON TABLE navp_processing_logs IS 'Logs de procesamiento de pagos NAVP';

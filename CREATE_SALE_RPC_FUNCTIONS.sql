-- =========================================================
-- FUNCIONES RPC PARA EL SISTEMA DE VENTA DE HNLD
-- =========================================================

-- Función para generar código único para solicitudes de venta
-- Formato: NMHNV-YYMMDD-000000
CREATE OR REPLACE FUNCTION generate_sale_unique_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date TEXT;
    next_number INTEGER;
    generated_code TEXT;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    -- Obtener fecha actual en formato YYMMDD
    today_date := TO_CHAR(NOW(), 'YYMMDD');
    
    -- Obtener el siguiente número disponible para hoy
    -- Extraer solo la parte numérica después del último guion usando SPLIT_PART
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN sr.unique_code ~ '^NMHNV-[0-9]{6}-[0-9]{6}$' THEN
                    -- Extraer la parte numérica (después del último guion)
                    CAST(SPLIT_PART(sr.unique_code, '-', 3) AS INTEGER)
                ELSE
                    NULL
            END
        ), 
        0
    ) + 1
    INTO next_number
    FROM sale_requests sr
    WHERE sr.unique_code LIKE 'NMHNV-' || today_date || '-%'
    AND sr.unique_code ~ '^NMHNV-[0-9]{6}-[0-9]{6}$';
    
    -- Generar código único inicial
    generated_code := 'NMHNV-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar que el código no existe
    LOOP
        SELECT EXISTS(SELECT 1 FROM sale_requests WHERE unique_code = generated_code)
        INTO code_exists;
        
        EXIT WHEN NOT code_exists;
        
        next_number := next_number + 1;
        generated_code := 'NMHNV-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
        attempt_count := attempt_count + 1;
        
        EXIT WHEN attempt_count >= max_attempts;
    END LOOP;
    
    -- Si se agotaron los intentos, usar timestamp como fallback
    IF attempt_count >= max_attempts THEN
        generated_code := 'NMHNV-' || today_date || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000, 6, '0');
    END IF;
    
    RETURN generated_code;
END;
$$;

-- Función para crear solicitud de venta
CREATE OR REPLACE FUNCTION create_sale_request(
    p_seller_id UUID,
    p_amount DECIMAL(15,2),
    p_payment_method VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 7,
    p_bank_name VARCHAR(255) DEFAULT NULL,
    p_custom_bank_name VARCHAR(255) DEFAULT NULL,
    p_country VARCHAR(100) DEFAULT NULL,
    p_custom_country VARCHAR(255) DEFAULT NULL,
    p_digital_wallet VARCHAR(50) DEFAULT NULL,
    p_currency_type VARCHAR(10) DEFAULT 'L',
    p_amount_in_original_currency DECIMAL(15,2) DEFAULT NULL,
    p_exchange_rate_applied DECIMAL(10,4) DEFAULT 1.0000,
    p_final_amount_hnld DECIMAL(15,2) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    request_id UUID,
    unique_code TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_request_id UUID := gen_random_uuid();
    generated_code TEXT;
    current_user_id UUID;
    v_balance DECIMAL(15,2);
    v_available_balance DECIMAL(15,2);
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Verificar que el usuario está autenticado
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Usuario no autenticado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar que el seller_id coincide con el usuario autenticado
    IF current_user_id != p_seller_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'No tienes permisos para crear esta solicitud'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar que el monto es válido
    IF p_amount <= 0 OR (p_final_amount_hnld IS NOT NULL AND p_final_amount_hnld <= 0) THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'El monto debe ser mayor a 0'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar balance disponible del vendedor
    SELECT COALESCE(balance, 0) - COALESCE(reserved_balance, 0) INTO v_available_balance
    FROM hnld_balances
    WHERE user_id = p_seller_id;
    
    -- Si no existe balance, crear registro con 0
    IF v_available_balance IS NULL THEN
        INSERT INTO hnld_balances (user_id, balance, reserved_balance)
        VALUES (p_seller_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_available_balance := 0;
    END IF;
    
    -- Verificar que tiene suficiente balance disponible
    IF v_available_balance < COALESCE(p_final_amount_hnld, p_amount) THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 
            format('Balance insuficiente. Disponible: L. %s, Solicitado: L. %s', 
                v_available_balance, COALESCE(p_final_amount_hnld, p_amount))::TEXT;
        RETURN;
    END IF;
    
    -- Generar código único
    generated_code := generate_sale_unique_code();
    
    -- Crear la solicitud
    INSERT INTO sale_requests (
        id,
        seller_id,
        amount,
        currency,
        description,
        status,
        payment_method,
        bank_name,
        custom_bank_name,
        country,
        custom_country,
        digital_wallet,
        currency_type,
        amount_in_original_currency,
        exchange_rate_applied,
        final_amount_hnld,
        unique_code,
        expires_at,
        created_at,
        updated_at
    ) VALUES (
        new_request_id,
        p_seller_id,
        COALESCE(p_final_amount_hnld, p_amount),
        'HNLD',
        p_description,
        'active',
        p_payment_method,
        p_bank_name,
        p_custom_bank_name,
        p_country,
        p_custom_country,
        p_digital_wallet,
        p_currency_type,
        p_amount_in_original_currency,
        p_exchange_rate_applied,
        COALESCE(p_final_amount_hnld, p_amount),
        generated_code,
        NOW() + (p_expires_in_days || ' days')::INTERVAL,
        NOW(),
        NOW()
    );
    
    RETURN QUERY SELECT true, new_request_id, generated_code, 'Solicitud de venta creada exitosamente'::TEXT;
END;
$$;

-- Función para obtener solicitudes de venta activas (para compradores)
CREATE OR REPLACE FUNCTION get_active_sale_requests(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    buyer_id UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    bank_name VARCHAR(255),
    custom_bank_name VARCHAR(255),
    country VARCHAR(100),
    custom_country VARCHAR(100),
    digital_wallet VARCHAR(50),
    currency_type VARCHAR(10),
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    unique_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    seller_name TEXT,
    seller_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, retornar vacío
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        sr.id::UUID,
        sr.seller_id::UUID,
        sr.amount::DECIMAL(15,2),
        sr.final_amount_hnld::DECIMAL(15,2),
        sr.description::TEXT,
        sr.status::VARCHAR(20),
        sr.buyer_id::UUID,
        sr.accepted_at::TIMESTAMP WITH TIME ZONE,
        sr.payment_method::VARCHAR(50),
        sr.bank_name::VARCHAR(255),
        sr.custom_bank_name::VARCHAR(255),
        sr.country::VARCHAR(100),
        sr.custom_country::VARCHAR(100),
        sr.digital_wallet::VARCHAR(50),
        sr.currency_type::VARCHAR(10),
        sr.amount_in_original_currency::DECIMAL(15,2),
        sr.exchange_rate_applied::DECIMAL(10,4),
        sr.unique_code::VARCHAR(50),
        sr.expires_at::TIMESTAMP WITH TIME ZONE,
        sr.created_at::TIMESTAMP WITH TIME ZONE,
        sr.updated_at::TIMESTAMP WITH TIME ZONE,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario')::TEXT as seller_name,
        au.email::TEXT as seller_email
    FROM sale_requests sr
    JOIN auth.users au ON au.id = sr.seller_id
    LEFT JOIN public.profiles p ON p.id = sr.seller_id
    WHERE sr.status = 'active' 
    AND sr.expires_at > NOW()
    AND sr.seller_id != current_user_id -- Excluir las propias solicitudes
    ORDER BY sr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Función para obtener solicitudes de venta del usuario
CREATE OR REPLACE FUNCTION get_user_sale_requests(
    p_user_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    payment_method VARCHAR(50),
    bank_name VARCHAR(255),
    custom_bank_name VARCHAR(255),
    country VARCHAR(100),
    custom_country VARCHAR(100),
    digital_wallet VARCHAR(50),
    currency_type VARCHAR(10),
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    unique_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_id UUID,
    accepted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.amount,
        sr.final_amount_hnld,
        sr.description,
        sr.status,
        sr.payment_method,
        sr.bank_name,
        sr.custom_bank_name,
        sr.country,
        sr.custom_country,
        sr.digital_wallet,
        sr.currency_type,
        sr.amount_in_original_currency,
        sr.exchange_rate_applied,
        sr.unique_code,
        sr.expires_at,
        sr.created_at,
        sr.updated_at,
        sr.buyer_id,
        sr.accepted_at
    FROM sale_requests sr
    WHERE sr.seller_id = p_user_id
    AND (p_status IS NULL OR sr.status = p_status)
    ORDER BY sr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Función para cancelar solicitud de venta
CREATE OR REPLACE FUNCTION cancel_sale_request(
    p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller_id UUID;
BEGIN
    -- Obtener el seller_id de la solicitud
    SELECT seller_id INTO v_seller_id
    FROM sale_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    -- Verificar que el usuario es el vendedor
    IF v_seller_id != auth.uid() THEN
        RAISE EXCEPTION 'No tienes permisos para cancelar esta solicitud';
    END IF;
    
    -- Verificar que la solicitud puede ser cancelada
    IF NOT EXISTS (
        SELECT 1 FROM sale_requests 
        WHERE id = p_request_id 
        AND status IN ('active', 'negotiating')
    ) THEN
        RAISE EXCEPTION 'La solicitud no puede ser cancelada en su estado actual';
    END IF;
    
    -- Actualizar estado
    UPDATE sale_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_request_id;
    
    RETURN true;
END;
$$;

-- Función para aceptar solicitud de venta (crear transacción)
CREATE OR REPLACE FUNCTION accept_sale_request(
    p_request_id UUID,
    p_buyer_id UUID,
    p_payment_method VARCHAR(50),
    p_payment_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_request_data RECORD;
    v_payment_deadline TIMESTAMP WITH TIME ZONE;
    v_current_user_id UUID;
    v_buyer_name TEXT;
    v_seller_name TEXT;
    v_formatted_amount TEXT;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Verificar que el buyer_id coincide
    IF v_current_user_id != p_buyer_id THEN
        RAISE EXCEPTION 'No tienes permisos para aceptar esta solicitud';
    END IF;
    
    -- Obtener datos de la solicitud
    SELECT * INTO v_request_data
    FROM sale_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    IF v_request_data.status != 'active' THEN
        RAISE EXCEPTION 'La solicitud no está disponible para transacción';
    END IF;
    
    -- Verificar que el comprador no es el mismo que el vendedor
    IF v_request_data.seller_id = p_buyer_id THEN
        RAISE EXCEPTION 'No puedes comprar tu propia solicitud de venta';
    END IF;
    
    -- Obtener nombres para la notificación
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_buyer_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = p_buyer_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_seller_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_request_data.seller_id;
    
    -- Formatear monto
    v_formatted_amount := CASE 
        WHEN v_request_data.currency_type = 'USD' THEN '$' || COALESCE(v_request_data.amount_in_original_currency::TEXT, v_request_data.final_amount_hnld::TEXT)
        WHEN v_request_data.currency_type = 'EUR' THEN '€' || COALESCE(v_request_data.amount_in_original_currency::TEXT, v_request_data.final_amount_hnld::TEXT)
        ELSE 'L.' || COALESCE(v_request_data.final_amount_hnld::TEXT, '0')
    END;
    
    -- Calcular deadline de pago (24 horas por defecto)
    v_payment_deadline := NOW() + INTERVAL '24 hours';
    
    -- Crear la transacción
    INSERT INTO sale_transactions (
        id,
        request_id,
        seller_id,
        buyer_id,
        amount,
        currency,
        exchange_rate,
        final_amount_hnld,
        payment_method,
        payment_details,
        status,
        payment_deadline,
        created_at,
        updated_at
    ) VALUES (
        v_transaction_id,
        p_request_id,
        v_request_data.seller_id,
        p_buyer_id,
        COALESCE(v_request_data.amount_in_original_currency, v_request_data.amount),
        COALESCE(v_request_data.currency_type, 'L'),
        COALESCE(v_request_data.exchange_rate_applied, 1.0),
        v_request_data.final_amount_hnld,
        p_payment_method,
        p_payment_details,
        'pending', -- Pendiente de que el vendedor acepte y bloquee HNLD
        v_payment_deadline,
        NOW(),
        NOW()
    );
    
    -- Actualizar estado de la solicitud
    UPDATE sale_requests
    SET status = 'accepted',
        buyer_id = p_buyer_id,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Crear pasos de la transacción
    INSERT INTO sale_transaction_steps (transaction_id, step_name, step_order, step_description, status, created_at, updated_at) VALUES
    (v_transaction_id, 'seller_accepts_deal', 1, 'Vendedor acepta el trato y bloquea HNLD en escrow', 'pending', NOW(), NOW()),
    (v_transaction_id, 'buyer_pays', 2, 'Comprador realiza el pago y sube comprobante', 'pending', NOW(), NOW()),
    (v_transaction_id, 'seller_verifies_payment', 3, 'Vendedor verifica el comprobante de pago', 'pending', NOW(), NOW()),
    (v_transaction_id, 'hnld_released', 4, 'HNLD liberados al comprador', 'pending', NOW(), NOW());
    
    -- Enviar notificación al vendedor (comprador aceptó su solicitud)
    PERFORM emit_notification(
        v_request_data.seller_id,
        'order',
        'SALE_REQUEST_ACCEPTED',
        'Solicitud Aceptada',
        v_buyer_name || ' aceptó tu solicitud de venta por ' || v_formatted_amount || ' HNLD.' ||
        CASE WHEN v_request_data.unique_code IS NOT NULL THEN ' Código: ' || v_request_data.unique_code ELSE '' END,
        'Ver Transacción',
        '/dashboard/mis-ventas',
        'high',
        jsonb_build_object(
            'transaction_id', v_transaction_id,
            'request_id', p_request_id,
            'seller_id', v_request_data.seller_id,
            'buyer_id', p_buyer_id,
            'amount', v_request_data.final_amount_hnld,
            'formatted_amount', v_formatted_amount,
            'currency_type', v_request_data.currency_type,
            'unique_code', v_request_data.unique_code,
            'buyer_name', v_buyer_name
        ),
        'sale_request_accepted_' || p_request_id::TEXT || '_' || v_request_data.seller_id::TEXT,
        NULL
    );
    
    RETURN v_transaction_id;
END;
$$;


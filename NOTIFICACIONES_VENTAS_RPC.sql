-- =========================================================
-- NOTIFICACIONES EN FUNCIONES RPC DE VENTAS
-- =========================================================
-- Agrega notificaciones a las funciones RPC del sistema de ventas
-- =========================================================

-- =========================================================
-- 1. ACTUALIZAR accept_sale_request PARA ENVIAR NOTIFICACIÓN
-- =========================================================

-- Primero necesitamos ver la función actual para actualizarla
-- Esta función se actualizará para enviar notificación SALE_ACCEPTED al vendedor

-- =========================================================
-- 2. ACTUALIZAR lock_hnld_in_escrow_sale PARA ENVIAR NOTIFICACIÓN
-- =========================================================

CREATE OR REPLACE FUNCTION lock_hnld_in_escrow_sale(
    p_transaction_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction RECORD;
    v_request RECORD;
    v_available_balance DECIMAL(15,2);
    v_current_user_id UUID;
    v_buyer_name TEXT;
    v_seller_name TEXT;
    v_formatted_amount TEXT;
    v_unique_code TEXT;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Obtener información de la transacción y solicitud
    SELECT 
        st.*,
        sr.unique_code,
        sr.final_amount_hnld,
        sr.currency_type
    INTO v_transaction
    FROM sale_transactions st
    JOIN sale_requests sr ON sr.id = st.request_id
    WHERE st.id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción no encontrada';
    END IF;
    
    -- Obtener información de la solicitud
    SELECT * INTO v_request
    FROM sale_requests
    WHERE id = v_transaction.request_id;
    
    v_unique_code := v_request.unique_code;
    
    -- Verificar que el usuario es el vendedor
    IF v_transaction.seller_id != v_current_user_id THEN
        RAISE EXCEPTION 'Solo el vendedor puede bloquear HNLD en escrow';
    END IF;
    
    -- Verificar que la transacción está en estado pendiente
    IF v_transaction.status != 'pending' THEN
        RAISE EXCEPTION 'La transacción no está en estado pendiente';
    END IF;
    
    -- Verificar balance disponible del vendedor
    SELECT COALESCE(balance, 0) - COALESCE(reserved_balance, 0) INTO v_available_balance
    FROM hnld_balances
    WHERE user_id = v_transaction.seller_id;
    
    -- Si no existe balance, crear registro
    IF v_available_balance IS NULL THEN
        INSERT INTO hnld_balances (user_id, balance, reserved_balance)
        VALUES (v_transaction.seller_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_available_balance := 0;
    END IF;
    
    -- Verificar que tiene suficiente balance disponible
    IF v_available_balance < v_transaction.final_amount_hnld THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: L. %, Solicitado: L. %', 
            v_available_balance, v_transaction.final_amount_hnld;
    END IF;
    
    -- Obtener nombres para la notificación
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_buyer_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.buyer_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_seller_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.seller_id;
    
    -- Formatear monto
    v_formatted_amount := CASE 
        WHEN v_transaction.currency_type = 'USD' THEN '$' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        WHEN v_transaction.currency_type = 'EUR' THEN '€' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        ELSE 'L.' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
    END;
    
    -- Bloquear HNLD en escrow (aumentar reserved_balance)
    UPDATE hnld_balances
    SET reserved_balance = reserved_balance + v_transaction.final_amount_hnld,
        updated_at = NOW()
    WHERE user_id = v_transaction.seller_id;
    
    -- Actualizar transacción
    UPDATE sale_transactions
    SET status = 'agreement_confirmed',
        escrow_amount = v_transaction.final_amount_hnld,
        escrow_status = 'protected',
        agreement_confirmed_at = NOW(),
        payment_deadline = NOW() + INTERVAL '24 hours',
        verification_deadline = NOW() + INTERVAL '48 hours',
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Actualizar paso 1 a completado y paso 2 a in_progress
    UPDATE sale_transaction_steps
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = v_current_user_id,
        updated_at = NOW()
    WHERE transaction_id = p_transaction_id AND step_order = 1;
    
    UPDATE sale_transaction_steps
    SET status = 'in_progress',
        updated_at = NOW()
    WHERE transaction_id = p_transaction_id AND step_order = 2;
    
    -- Enviar notificación al comprador (SALE_ACCEPTED)
    PERFORM emit_notification(
        v_transaction.buyer_id,
        'order',
        'SALE_ACCEPTED',
        'Trato Aceptado',
        v_seller_name || ' aceptó tu solicitud de compra y bloqueó ' || v_formatted_amount || ' HNLD en escrow.' || 
        CASE WHEN v_unique_code IS NOT NULL THEN ' Código: ' || v_unique_code ELSE '' END,
        'Ver Transacción',
        '/dashboard/ventas',
        'high',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'request_id', v_transaction.request_id,
            'seller_id', v_transaction.seller_id,
            'buyer_id', v_transaction.buyer_id,
            'amount', v_transaction.final_amount_hnld,
            'formatted_amount', v_formatted_amount,
            'currency_type', v_transaction.currency_type,
            'unique_code', v_unique_code,
            'seller_name', v_seller_name
        ),
        'sale_accepted_' || v_transaction.request_id::TEXT || '_' || v_transaction.buyer_id::TEXT,
        NULL
    );
    
    RETURN true;
END;
$$;

-- =========================================================
-- 3. ACTUALIZAR debit_hnld_from_seller PARA ENVIAR NOTIFICACIÓN
-- =========================================================

CREATE OR REPLACE FUNCTION debit_hnld_from_seller(
    p_transaction_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction RECORD;
    v_request RECORD;
    v_hnld_transaction_id UUID := gen_random_uuid();
    v_current_user_id UUID;
    v_buyer_name TEXT;
    v_seller_name TEXT;
    v_formatted_amount TEXT;
    v_unique_code TEXT;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Obtener información de la transacción y solicitud
    SELECT 
        st.*,
        sr.unique_code,
        sr.final_amount_hnld,
        sr.currency_type
    INTO v_transaction
    FROM sale_transactions st
    JOIN sale_requests sr ON sr.id = st.request_id
    WHERE st.id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción no encontrada';
    END IF;
    
    -- Obtener información de la solicitud
    SELECT * INTO v_request
    FROM sale_requests
    WHERE id = v_transaction.request_id;
    
    v_unique_code := v_request.unique_code;
    
    -- Verificar que el usuario es el vendedor
    IF v_transaction.seller_id != v_current_user_id THEN
        RAISE EXCEPTION 'Solo el vendedor puede liberar HNLD';
    END IF;
    
    -- Verificar que el pago ha sido verificado
    IF v_transaction.status != 'payment_verified' THEN
        RAISE EXCEPTION 'El pago debe estar verificado antes de liberar HNLD';
    END IF;
    
    -- Verificar que los HNLD están bloqueados en escrow
    IF v_transaction.escrow_status != 'protected' OR v_transaction.escrow_amount IS NULL THEN
        RAISE EXCEPTION 'Los HNLD no están bloqueados en escrow';
    END IF;
    
    -- Verificar balance reservado del vendedor
    IF NOT EXISTS (
        SELECT 1 FROM hnld_balances
        WHERE user_id = v_transaction.seller_id
        AND reserved_balance >= v_transaction.escrow_amount
    ) THEN
        RAISE EXCEPTION 'Balance reservado insuficiente';
    END IF;
    
    -- Obtener nombres para la notificación
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_buyer_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.buyer_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_seller_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.seller_id;
    
    -- Formatear monto
    v_formatted_amount := CASE 
        WHEN v_transaction.currency_type = 'USD' THEN '$' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        WHEN v_transaction.currency_type = 'EUR' THEN '€' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        ELSE 'L.' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
    END;
    
    -- Crear transacción de venta para el vendedor (withdrawal)
    INSERT INTO hnld_transactions (
        id,
        user_id,
        transaction_type,
        amount,
        status,
        description,
        from_user_id,
        to_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_hnld_transaction_id,
        v_transaction.seller_id,
        'withdrawal',
        v_transaction.final_amount_hnld,
        'completed',
        format('Código: %s', v_unique_code),
        v_transaction.seller_id,
        v_transaction.buyer_id,
        NOW(),
        NOW()
    );
    
    -- Crear transacción de compra para el comprador (deposit)
    INSERT INTO hnld_transactions (
        id,
        user_id,
        transaction_type,
        amount,
        status,
        description,
        from_user_id,
        to_user_id,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_transaction.buyer_id,
        'deposit',
        v_transaction.final_amount_hnld,
        'completed',
        format('Código: %s', v_unique_code),
        v_transaction.seller_id,
        v_transaction.buyer_id,
        NOW(),
        NOW()
    );
    
    -- Debitar del vendedor (reducir balance y reserved_balance)
    UPDATE hnld_balances
    SET balance = balance - v_transaction.escrow_amount,
        reserved_balance = reserved_balance - v_transaction.escrow_amount,
        updated_at = NOW()
    WHERE user_id = v_transaction.seller_id;
    
    -- Acreditar al comprador (aumentar balance)
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (v_transaction.buyer_id, v_transaction.escrow_amount, 0.00)
    ON CONFLICT (user_id)
    DO UPDATE SET
        balance = hnld_balances.balance + v_transaction.escrow_amount,
        updated_at = NOW();
    
    -- Actualizar transacción
    UPDATE sale_transactions
    SET status = 'hnld_released',
        escrow_status = 'released',
        hnld_released_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Actualizar paso 4 a completado
    UPDATE sale_transaction_steps
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = v_current_user_id,
        updated_at = NOW()
    WHERE transaction_id = p_transaction_id AND step_order = 4;
    
    -- Enviar notificación al comprador (HNLD liberados)
    PERFORM emit_notification(
        v_transaction.buyer_id,
        'order',
        'SALE_HNLD_RELEASED',
        'HNLD Liberados',
        'Se han acreditado ' || v_formatted_amount || ' HNLD a tu cuenta.' ||
        CASE WHEN v_unique_code IS NOT NULL THEN ' Código: ' || v_unique_code ELSE '' END,
        'Ver Transacción',
        '/dashboard/ventas',
        'high',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'request_id', v_transaction.request_id,
            'amount', v_transaction.final_amount_hnld,
            'formatted_amount', v_formatted_amount,
            'unique_code', v_unique_code
        ),
        'sale_hnld_released_' || v_transaction.request_id::TEXT || '_' || v_transaction.buyer_id::TEXT,
        NULL
    );
    
    RETURN v_hnld_transaction_id;
END;
$$;

-- =========================================================
-- 4. ACTUALIZAR mark_sale_request_completed PARA ENVIAR NOTIFICACIÓN
-- =========================================================

CREATE OR REPLACE FUNCTION mark_sale_request_completed(
    p_transaction_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction RECORD;
    v_request RECORD;
    v_current_user_id UUID;
    v_buyer_name TEXT;
    v_seller_name TEXT;
    v_formatted_amount TEXT;
    v_unique_code TEXT;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Obtener información de la transacción y solicitud
    SELECT 
        st.*,
        sr.unique_code,
        sr.final_amount_hnld,
        sr.currency_type
    INTO v_transaction
    FROM sale_transactions st
    JOIN sale_requests sr ON sr.id = st.request_id
    WHERE st.id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transacción no encontrada';
    END IF;
    
    -- Obtener información de la solicitud
    SELECT * INTO v_request
    FROM sale_requests
    WHERE id = v_transaction.request_id;
    
    v_unique_code := v_request.unique_code;
    
    -- Verificar que el usuario es el comprador o vendedor
    IF v_transaction.buyer_id != v_current_user_id AND v_transaction.seller_id != v_current_user_id THEN
        RAISE EXCEPTION 'Solo el comprador o vendedor pueden completar la transacción';
    END IF;
    
    -- Verificar que los HNLD han sido liberados
    IF v_transaction.status != 'hnld_released' THEN
        RAISE EXCEPTION 'Los HNLD deben ser liberados antes de completar la transacción';
    END IF;
    
    -- Obtener nombres para la notificación
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_buyer_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.buyer_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') INTO v_seller_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id = v_transaction.seller_id;
    
    -- Formatear monto
    v_formatted_amount := CASE 
        WHEN v_transaction.currency_type = 'USD' THEN '$' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        WHEN v_transaction.currency_type = 'EUR' THEN '€' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
        ELSE 'L.' || COALESCE(v_transaction.final_amount_hnld::TEXT, '0')
    END;
    
    -- Actualizar transacción
    UPDATE sale_transactions
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Actualizar solicitud
    UPDATE sale_requests
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = v_transaction.request_id;
    
    -- Enviar notificación al comprador (SALE_COMPLETED)
    PERFORM emit_notification(
        v_transaction.buyer_id,
        'order',
        'SALE_COMPLETED',
        'Venta Completada',
        'La transacción con ' || v_seller_name || ' por ' || v_formatted_amount || ' HNLD ha sido completada exitosamente.' ||
        CASE WHEN v_unique_code IS NOT NULL THEN ' Código: ' || v_unique_code ELSE '' END,
        'Ver Transacción',
        '/dashboard/ventas',
        'high',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'request_id', v_transaction.request_id,
            'seller_id', v_transaction.seller_id,
            'buyer_id', v_transaction.buyer_id,
            'amount', v_transaction.final_amount_hnld,
            'formatted_amount', v_formatted_amount,
            'currency_type', v_transaction.currency_type,
            'unique_code', v_unique_code,
            'seller_name', v_seller_name
        ),
        'sale_completed_' || v_transaction.request_id::TEXT || '_buyer_' || v_transaction.buyer_id::TEXT,
        NULL
    );
    
    -- Enviar notificación al vendedor (SALE_COMPLETED)
    PERFORM emit_notification(
        v_transaction.seller_id,
        'order',
        'SALE_COMPLETED',
        'Venta Completada',
        'La transacción con ' || v_buyer_name || ' por ' || v_formatted_amount || ' HNLD ha sido completada exitosamente.' ||
        CASE WHEN v_unique_code IS NOT NULL THEN ' Código: ' || v_unique_code ELSE '' END,
        'Ver Transacción',
        '/dashboard/mis-ventas',
        'high',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'request_id', v_transaction.request_id,
            'seller_id', v_transaction.seller_id,
            'buyer_id', v_transaction.buyer_id,
            'amount', v_transaction.final_amount_hnld,
            'formatted_amount', v_formatted_amount,
            'currency_type', v_transaction.currency_type,
            'unique_code', v_unique_code,
            'buyer_name', v_buyer_name
        ),
        'sale_completed_' || v_transaction.request_id::TEXT || '_seller_' || v_transaction.seller_id::TEXT,
        NULL
    );
    
    RETURN true;
END;
$$;

-- =========================================================
-- 5. ACTUALIZAR accept_sale_request PARA ENVIAR NOTIFICACIÓN
-- =========================================================

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

-- =========================================================
-- 6. VERIFICAR CONFIGURACIÓN
-- =========================================================

-- Verificar que las funciones se actualizaron correctamente
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'lock_hnld_in_escrow_sale',
    'debit_hnld_from_seller',
    'mark_sale_request_completed'
)
AND routine_schema = 'public';

SELECT 'Sistema de notificaciones para funciones RPC de ventas configurado correctamente' as resultado;


-- =========================================================
-- FIX: Corregir llamadas a emit_notification en create_direct_transfer
-- =========================================================
-- Este script corrige el orden de los parámetros en las llamadas a emit_notification
-- dentro de la función create_direct_transfer

-- Eliminar función existente
DROP FUNCTION IF EXISTS create_direct_transfer(UUID, NUMERIC, TEXT);

-- Recrear función con las llamadas corregidas
CREATE OR REPLACE FUNCTION create_direct_transfer(
    p_to_user_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_user_id UUID;
    v_transfer_id UUID;
    v_unique_code TEXT;
    v_hnld_transaction_id UUID;
    v_to_user_name TEXT;
    v_from_user_name TEXT;
    v_available_balance NUMERIC;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Validar que no se transfiera a sí mismo
    IF v_current_user_id = p_to_user_id THEN
        RAISE EXCEPTION 'No puedes transferir a ti mismo';
    END IF;
    
    -- Validar que el destinatario existe
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to_user_id) THEN
        RAISE EXCEPTION 'Usuario destinatario no encontrado';
    END IF;
    
    -- Validar monto
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;
    
    -- Verificar balance disponible del remitente
    SELECT COALESCE(balance, 0) - COALESCE(reserved_balance, 0) INTO v_available_balance
    FROM hnld_balances
    WHERE user_id = v_current_user_id;
    
    -- Si no existe balance, crear registro
    IF v_available_balance IS NULL THEN
        INSERT INTO hnld_balances (user_id, balance, reserved_balance)
        VALUES (v_current_user_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_available_balance := 0;
    END IF;
    
    -- Verificar que tiene suficiente balance disponible
    IF v_available_balance < p_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: L. %, Solicitado: L. %', 
            v_available_balance, p_amount;
    END IF;
    
    -- Generar código único
    v_unique_code := format('NMHNT-%s-%s', 
        TO_CHAR(NOW(), 'YYYYMMDD'),
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
    );
    
    -- Obtener nombres de usuarios
    SELECT COALESCE(p.full_name, SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Usuario') INTO v_to_user_name
    FROM public.profiles p
    WHERE p.id = p_to_user_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Usuario') INTO v_from_user_name
    FROM public.profiles p
    WHERE p.id = v_current_user_id;
    
    -- Crear registro de transferencia
    INSERT INTO hnld_direct_transfers (
        id,
        from_user_id,
        to_user_id,
        amount,
        description,
        status,
        unique_code,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_current_user_id,
        p_to_user_id,
        p_amount,
        COALESCE(p_description, format('Transferencia de HNLD %s a %s', p_amount::TEXT, v_to_user_name)),
        'pending',
        format('Código: %s', v_unique_code),
        NOW(),
        NOW()
    ) RETURNING id INTO v_transfer_id;
    
    -- Procesar la transferencia inmediatamente
    -- Crear transacción HNLD
    v_hnld_transaction_id := gen_random_uuid();
    
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
        updated_at,
        processed_at
    ) VALUES (
        v_hnld_transaction_id,
        v_current_user_id,
        'transfer',
        p_amount,
        'completed',
        format('Código: %s', v_unique_code),
        v_current_user_id,
        p_to_user_id,
        NOW(),
        NOW(),
        NOW()
    );
    
    -- Debitar del remitente
    UPDATE hnld_balances
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE user_id = v_current_user_id;
    
    -- Acreditar al destinatario
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (p_to_user_id, p_amount, 0.00)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = hnld_balances.balance + p_amount,
        updated_at = NOW();
    
    -- Registrar en ledger (doble partida)
    -- Crédito: Disminuir balance del remitente
    INSERT INTO ledger_entries (
        transaction_id,
        user_id,
        entry_type,
        account_type,
        amount,
        description,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        v_hnld_transaction_id,
        v_current_user_id,
        'credit',
        'hnld_balance',
        p_amount,
        format('Código: %s', v_unique_code),
        'transfer',
        v_transfer_id,
        NOW()
    );
    
    -- Débito: Aumentar balance del destinatario
    INSERT INTO ledger_entries (
        transaction_id,
        user_id,
        entry_type,
        account_type,
        amount,
        description,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        v_hnld_transaction_id,
        p_to_user_id,
        'debit',
        'hnld_balance',
        p_amount,
        format('Código: %s', v_unique_code),
        'transfer',
        v_transfer_id,
        NOW()
    );
    
    -- Actualizar transferencia a completada
    UPDATE hnld_direct_transfers
    SET status = 'completed',
        processed_at = NOW(),
        hnld_transaction_id = v_hnld_transaction_id,
        updated_at = NOW()
    WHERE id = v_transfer_id;
    
    -- Emitir notificaciones
    -- Notificación al remitente
    PERFORM emit_notification(
        v_current_user_id,                    -- p_user_id
        'wallet',                              -- p_topic
        'TRANSFER_SENT',                       -- p_event
        format('Transferencia enviada a %s', v_to_user_name),  -- p_title
        format('Has transferido L.%s a %s. Código: %s', p_amount::TEXT, v_to_user_name, v_unique_code),  -- p_body
        'Ver transferencia',                   -- p_cta_label
        '/dashboard/transferencias',           -- p_cta_href
        'high',                                -- p_priority
        jsonb_build_object(
            'transfer_id', v_transfer_id,
            'to_user_id', p_to_user_id,
            'to_user_name', v_to_user_name,
            'amount', p_amount,
            'unique_code', v_unique_code
        ),                                     -- p_payload
        format('transfer_sent_%s', v_transfer_id)  -- p_dedupe_key
    );
    
    -- Notificación al destinatario
    PERFORM emit_notification(
        p_to_user_id,                          -- p_user_id
        'wallet',                              -- p_topic
        'TRANSFER_RECEIVED',                   -- p_event
        format('Has recibido una transferencia de %s', v_from_user_name),  -- p_title
        format('Has recibido L.%s de %s. Código: %s', p_amount::TEXT, v_from_user_name, v_unique_code),  -- p_body
        'Ver transferencia',                   -- p_cta_label
        '/dashboard/transferencias',           -- p_cta_href
        'high',                                -- p_priority
        jsonb_build_object(
            'transfer_id', v_transfer_id,
            'from_user_id', v_current_user_id,
            'from_user_name', v_from_user_name,
            'amount', p_amount,
            'unique_code', v_unique_code
        ),                                     -- p_payload
        format('transfer_received_%s', v_transfer_id)  -- p_dedupe_key
    );
    
    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', v_transfer_id,
        'unique_code', v_unique_code,
        'hnld_transaction_id', v_hnld_transaction_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Actualizar transferencia a fallida si existe
        IF v_transfer_id IS NOT NULL THEN
            UPDATE hnld_direct_transfers
            SET status = 'failed',
                failed_reason = SQLERRM,
                updated_at = NOW()
            WHERE id = v_transfer_id;
        END IF;
        
        RAISE;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION create_direct_transfer IS 'Crea una transferencia directa de HNLD entre usuarios y emite notificaciones correctamente';


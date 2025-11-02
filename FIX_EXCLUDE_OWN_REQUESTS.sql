-- =========================================================
-- NMHN - CORREGIR EXCLUSIÓN DE PROPIAS SOLICITUDES
-- =========================================================
-- Script para asegurar que las solicitudes del usuario actual
-- NO aparezcan en el panel de solicitudes de compra disponibles
-- =========================================================

-- =========================================================
-- PASO 1: ELIMINAR FUNCIONES EXISTENTES
-- =========================================================

DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER, UUID);

-- =========================================================
-- PASO 2: CREAR FUNCIÓN CORREGIDA CON FILTRO DE USUARIO
-- =========================================================

CREATE OR REPLACE FUNCTION get_active_purchase_requests(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_name TEXT,
    buyer_email TEXT,
    unique_code TEXT,
    payment_method TEXT,
    bank_name TEXT,
    custom_bank_name TEXT,
    country TEXT,
    custom_country TEXT,
    digital_wallet TEXT,
    currency_type TEXT,
    amount_in_original_currency DECIMAL(15,2),
    exchange_rate_applied DECIMAL(10,4),
    processing_fee_percentage DECIMAL(5,2),
    processing_fee_amount DECIMAL(15,2),
    final_amount_hnld DECIMAL(15,2),
    payment_reference TEXT,
    payment_status TEXT
) AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Obtener el ID del usuario actual
    current_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, retornar vacío
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        pr.id,
        pr.buyer_id,
        pr.amount,
        pr.description,
        pr.status::TEXT,
        pr.expires_at,
        pr.created_at,
        pr.updated_at,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario')::TEXT AS buyer_name,
        au.email::TEXT AS buyer_email,
        pr.unique_code::TEXT,
        pr.payment_method::TEXT,
        pr.bank_name::TEXT,
        pr.custom_bank_name::TEXT,
        pr.country::TEXT,
        pr.custom_country::TEXT,
        pr.digital_wallet::TEXT,
        pr.currency_type::TEXT,
        pr.amount_in_original_currency,
        pr.exchange_rate_applied,
        pr.processing_fee_percentage,
        pr.processing_fee_amount,
        pr.final_amount_hnld,
        pr.payment_reference::TEXT,
        pr.payment_status::TEXT
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.status = 'active'
    AND pr.expires_at > NOW()
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito
    AND pr.buyer_id != current_user_id  -- ⭐ EXCLUIR solicitudes del usuario actual ⭐
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 3: VERIFICAR FUNCIÓN CREADA
-- =========================================================

SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'get_active_purchase_requests'
AND routine_schema = 'public';

-- =========================================================
-- PASO 4: COMENTARIO SOBRE CAMBIOS
-- =========================================================

/*
CAMBIOS APLICADOS:

✅ La función get_active_purchase_requests ahora:
   - Excluye las solicitudes del usuario actual (pr.buyer_id != current_user_id)
   - Excluye solicitudes de tarjeta de crédito (pr.payment_method != 'card')
   - Solo muestra solicitudes activas y no expiradas
   - Retorna solicitudes de OTROS usuarios únicamente

RESULTADO:
- Panel "Solicitudes de Compra": Solo muestra solicitudes de otros usuarios
- Panel "Mis Solicitudes": Muestra las solicitudes del usuario actual (a través de get_user_purchase_requests)
- Las propias solicitudes del usuario NO aparecen en el panel público
*/





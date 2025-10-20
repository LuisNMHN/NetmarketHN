-- =========================================================
-- NMHN - EXCLUIR SOLICITUDES DE TARJETA DE CRÉDITO
-- =========================================================
-- Script para modificar get_active_purchase_requests y excluir compras directas
-- =========================================================

-- 1. Verificar función actual
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_active_purchase_requests'
AND routine_schema = 'public';

-- 2. Eliminar función existente
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER);

-- 3. Crear función actualizada que excluye tarjetas de crédito
CREATE OR REPLACE FUNCTION get_active_purchase_requests(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_user_id UUID DEFAULT NULL
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
    -- Obtener el usuario actual de manera más robusta
    current_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Si no hay usuario, usar un UUID vacío para evitar errores
    IF current_user_id IS NULL THEN
        current_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
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
    AND pr.buyer_id != current_user_id  -- EXCLUIR solicitudes del usuario actual
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito (compras directas)
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Probar la función actualizada
SELECT 
    id,
    payment_method,
    status,
    expires_at,
    created_at,
    unique_code
FROM get_active_purchase_requests(10, 0)
ORDER BY created_at DESC;

-- 5. Verificar que no aparecen solicitudes de tarjeta
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as solicitudes_tarjeta,
    COUNT(CASE WHEN payment_method != 'card' THEN 1 END) as solicitudes_publicables
FROM get_active_purchase_requests(100, 0);

-- 6. Comentarios
COMMENT ON FUNCTION get_active_purchase_requests IS 'Obtiene solicitudes activas excluyendo compras directas por tarjeta de crédito';

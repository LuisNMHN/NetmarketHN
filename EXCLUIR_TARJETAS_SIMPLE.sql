-- =========================================================
-- NMHN - VERSIÓN SIMPLE SIN AUTENTICACIÓN
-- =========================================================
-- Script alternativo para probar sin problemas de autenticación
-- =========================================================

-- 1. Eliminar función existente
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER, UUID);

-- 2. Crear función simple que excluye tarjetas de crédito
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
BEGIN
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
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito (compras directas)
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Probar la función simple
SELECT 
    id,
    payment_method,
    status,
    expires_at,
    created_at,
    unique_code
FROM get_active_purchase_requests(10, 0)
ORDER BY created_at DESC;

-- 4. Verificar que no aparecen solicitudes de tarjeta
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as solicitudes_tarjeta,
    COUNT(CASE WHEN payment_method != 'card' THEN 1 END) as solicitudes_publicables
FROM get_active_purchase_requests(100, 0);

-- 5. Mostrar métodos de pago disponibles
SELECT 
    payment_method,
    COUNT(*) as cantidad
FROM get_active_purchase_requests(100, 0)
GROUP BY payment_method
ORDER BY cantidad DESC;

-- 6. Comentarios
COMMENT ON FUNCTION get_active_purchase_requests IS 'Obtiene solicitudes activas excluyendo compras directas por tarjeta de crédito (versión simple)';


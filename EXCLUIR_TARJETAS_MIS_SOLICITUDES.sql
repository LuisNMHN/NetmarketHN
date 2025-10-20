-- =========================================================
-- NMHN - EXCLUIR SOLICITUDES DE TARJETA DE MIS SOLICITUDES
-- =========================================================
-- Script para modificar la función get_user_purchase_requests
-- para que no muestre las solicitudes con payment_method = 'card'.
-- Estas son compras directas y no requieren seguimiento en "Mis Solicitudes".
-- =========================================================

-- 1. Verificar función existente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'get_user_purchase_requests'
AND routine_schema = 'public';

-- 2. Eliminar función existente para evitar conflictos
DROP FUNCTION IF EXISTS get_user_purchase_requests(UUID, VARCHAR, INTEGER, INTEGER);

-- 3. Crear función actualizada que excluye tarjetas de crédito
CREATE OR REPLACE FUNCTION get_user_purchase_requests(
    p_user_id UUID,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    status TEXT,
    seller_id UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
    terms TEXT,
    exchange_rate DECIMAL(10,4),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_name TEXT,
    buyer_email TEXT,
    offers_count BIGINT,
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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.buyer_id,
        pr.amount,
        pr.description,
        pr.status::TEXT,
        pr.seller_id,
        pr.accepted_at,
        pr.terms,
        pr.exchange_rate,
        pr.expires_at,
        pr.created_at,
        pr.updated_at,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario')::TEXT AS buyer_name,
        au.email::TEXT AS buyer_email,
        (SELECT COUNT(*) FROM purchase_offers po WHERE po.request_id = pr.id) AS offers_count,
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
    WHERE pr.buyer_id = p_user_id
    AND (p_status IS NULL OR pr.status = p_status)
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito (compras directas)
    ORDER BY pr.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 4. Probar la función actualizada
-- Nota: Reemplaza 'TU_USER_ID_AQUI' con un UUID real de usuario
SELECT 
    id,
    payment_method,
    status,
    expires_at,
    created_at,
    unique_code
FROM get_user_purchase_requests('TU_USER_ID_AQUI'::UUID, NULL, 10, 0)
ORDER BY created_at DESC;

-- 5. Verificar que no aparecen solicitudes de tarjeta
-- Nota: Reemplaza 'TU_USER_ID_AQUI' con un UUID real de usuario
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as solicitudes_tarjeta,
    COUNT(CASE WHEN payment_method != 'card' THEN 1 END) as solicitudes_seguimiento
FROM get_user_purchase_requests('TU_USER_ID_AQUI'::UUID, NULL, 100, 0);

-- 6. Mostrar métodos de pago disponibles en "Mis Solicitudes"
-- Nota: Reemplaza 'TU_USER_ID_AQUI' con un UUID real de usuario
SELECT 
    payment_method,
    COUNT(*) as cantidad
FROM get_user_purchase_requests('TU_USER_ID_AQUI'::UUID, NULL, 100, 0)
GROUP BY payment_method
ORDER BY cantidad DESC;

-- 7. Comentarios
COMMENT ON FUNCTION get_user_purchase_requests IS 'Obtiene solicitudes del usuario excluyendo compras directas por tarjeta de crédito';

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================


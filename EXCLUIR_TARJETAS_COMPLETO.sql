-- =========================================================
-- NMHN - EXCLUIR TARJETAS DE CRÉDITO COMPLETO
-- =========================================================
-- Script completo para excluir solicitudes de tarjeta de crédito
-- tanto del panel de vendedores como del panel "Mis Solicitudes"
-- =========================================================

-- 1. Verificar funciones existentes
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('get_active_purchase_requests', 'get_user_purchase_requests')
AND routine_schema = 'public';

-- 2. Eliminar funciones existentes para evitar conflictos
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_user_purchase_requests(UUID, VARCHAR, INTEGER, INTEGER);

-- =========================================================
-- FUNCIÓN 1: get_active_purchase_requests (Panel de Vendedores)
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
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN 2: get_user_purchase_requests (Mis Solicitudes)
-- =========================================================

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
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito
    ORDER BY pr.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- =========================================================
-- PRUEBAS Y VERIFICACIONES
-- =========================================================

-- 3. Probar función de vendedores (sin tarjetas)
SELECT 
    'VENDEDORES' as panel,
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as solicitudes_tarjeta,
    COUNT(CASE WHEN payment_method != 'card' THEN 1 END) as solicitudes_publicables
FROM get_active_purchase_requests(100, 0);

-- 4. Mostrar métodos de pago en panel de vendedores
SELECT 
    'VENDEDORES' as panel,
    payment_method,
    COUNT(*) as cantidad
FROM get_active_purchase_requests(100, 0)
GROUP BY payment_method
ORDER BY cantidad DESC;

-- 5. Verificar que las funciones se crearon correctamente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('get_active_purchase_requests', 'get_user_purchase_requests')
AND routine_schema = 'public'
ORDER BY routine_name;

-- 6. Comentarios
COMMENT ON FUNCTION get_active_purchase_requests IS 'Obtiene solicitudes activas excluyendo compras directas por tarjeta de crédito (panel vendedores)';
COMMENT ON FUNCTION get_user_purchase_requests IS 'Obtiene solicitudes del usuario excluyendo compras directas por tarjeta de crédito (mis solicitudes)';

-- =========================================================
-- RESUMEN DE CAMBIOS
-- =========================================================
/*
CAMBIOS REALIZADOS:

1. ✅ Panel "Solicitudes de Compra" (Vendedores):
   - Excluye solicitudes con payment_method = 'card'
   - Solo muestra solicitudes que requieren vendedor

2. ✅ Panel "Mis Solicitudes" (Compradores):
   - Excluye solicitudes con payment_method = 'card'
   - Solo muestra solicitudes que requieren seguimiento

3. ✅ Lógica de Negocio:
   - Tarjetas de crédito = Compra directa (Stripe)
   - No requieren vendedor ni seguimiento
   - Procesamiento inmediato

RESULTADO:
- Las compras por tarjeta se procesan directamente
- No aparecen en ningún panel de seguimiento
- Mejor experiencia de usuario
*/
-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================


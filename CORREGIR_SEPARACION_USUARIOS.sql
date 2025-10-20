-- =========================================================
-- NMHN - CORREGIR SEPARACIÓN DE SOLICITUDES POR USUARIO
-- =========================================================
-- Script para corregir que las solicitudes se muestren correctamente:
-- - Mis Solicitudes: Solo solicitudes del usuario actual
-- - Solicitudes de Compra: Solo solicitudes de otros usuarios
-- =========================================================

-- =========================================================
-- PASO 1: ELIMINAR FUNCIONES EXISTENTES
-- =========================================================

DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_purchase_requests(INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_user_purchase_requests(UUID, VARCHAR(20), INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_purchase_requests(UUID, TEXT, INTEGER, INTEGER);

-- =========================================================
-- PASO 2: FUNCIÓN PARA SOLICITUDES DE COMPRA (OTROS USUARIOS)
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
    AND pr.buyer_id != current_user_id  -- EXCLUIR solicitudes del usuario actual
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 3: FUNCIÓN PARA MIS SOLICITUDES (USUARIO ACTUAL)
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
    WHERE pr.buyer_id = p_user_id  -- SOLO solicitudes del usuario especificado
    AND (p_status IS NULL OR pr.status = p_status)
    AND pr.payment_method != 'card'  -- EXCLUIR solicitudes de tarjeta de crédito
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 4: VERIFICAR FUNCIONES CREADAS
-- =========================================================

-- Verificar que las funciones se crearon correctamente
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN ('get_active_purchase_requests', 'get_user_purchase_requests')
AND routine_schema = 'public'
ORDER BY routine_name;

-- =========================================================
-- PASO 5: PRUEBA DE FUNCIONES
-- =========================================================

-- Probar función de solicitudes activas (debe excluir las del usuario actual)
SELECT 'PRUEBA: Solicitudes de otros usuarios' as test_name;
SELECT COUNT(*) as total_solicitudes_otros_usuarios
FROM get_active_purchase_requests(10, 0);

-- Probar función de solicitudes del usuario (debe mostrar solo las del usuario actual)
SELECT 'PRUEBA: Solicitudes del usuario actual' as test_name;
-- Nota: Esta prueba requiere un UUID de usuario específico
-- SELECT COUNT(*) as total_solicitudes_usuario_actual
-- FROM get_user_purchase_requests('UUID_DEL_USUARIO_AQUI', NULL, 10, 0);

-- =========================================================
-- RESUMEN DE CAMBIOS
-- =========================================================

/*
CAMBIOS REALIZADOS:

1. get_active_purchase_requests():
   - ✅ Excluye solicitudes del usuario actual (pr.buyer_id != current_user_id)
   - ✅ Excluye solicitudes de tarjeta de crédito (pr.payment_method != 'card')
   - ✅ Solo muestra solicitudes activas y no expiradas
   - ✅ Muestra información completa del comprador

2. get_user_purchase_requests():
   - ✅ Solo muestra solicitudes del usuario especificado (pr.buyer_id = p_user_id)
   - ✅ Excluye solicitudes de tarjeta de crédito (pr.payment_method != 'card')
   - ✅ Incluye conteo de ofertas
   - ✅ Muestra información completa del usuario

RESULTADO ESPERADO:
- Panel "Mis Solicitudes": Solo solicitudes del usuario actual
- Panel "Solicitudes de Compra": Solo solicitudes de otros usuarios
- Ambos paneles excluyen solicitudes de tarjeta de crédito
*/

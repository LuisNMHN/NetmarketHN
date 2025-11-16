-- =========================================================
-- SCRIPT PARA CORREGIR LA FUNCIÓN get_active_sale_requests
-- Asegura que la función esté correctamente definida
-- =========================================================

-- Eliminar función existente si hay problemas
DROP FUNCTION IF EXISTS get_active_sale_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_sale_requests(INTEGER);

-- Recrear la función con la firma correcta
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
    payment_method VARCHAR(50),
    bank_name VARCHAR(255),
    country VARCHAR(100),
    digital_wallet VARCHAR(50),
    currency_type VARCHAR(10),
    amount_in_original_currency DECIMAL(15,2),
    unique_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    seller_name TEXT,
    seller_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
        sr.id,
        sr.seller_id,
        sr.amount,
        sr.final_amount_hnld,
        sr.description,
        sr.payment_method,
        sr.bank_name,
        sr.country,
        sr.digital_wallet,
        sr.currency_type,
        sr.amount_in_original_currency,
        sr.unique_code,
        sr.expires_at,
        sr.created_at,
        COALESCE(p.full_name, u.email) as seller_name,
        u.email as seller_email
    FROM sale_requests sr
    JOIN auth.users u ON u.id = sr.seller_id
    LEFT JOIN profiles p ON p.id = sr.seller_id
    WHERE sr.status = 'active' 
    AND sr.expires_at > NOW()
    AND sr.seller_id != current_user_id -- Excluir las propias solicitudes
    ORDER BY sr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_active_sale_requests(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_sale_requests(INTEGER, INTEGER) TO anon;


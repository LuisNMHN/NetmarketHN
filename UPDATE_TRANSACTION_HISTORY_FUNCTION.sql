-- =========================================================
-- ACTUALIZAR FUNCIÓN: get_user_transaction_history
-- =========================================================
-- Mejora la función para asegurar que muestre TODAS las
-- transacciones HNLD del usuario, incluyendo:
-- - Depósitos (compras de HNLD)
-- - Retiros (ventas de HNLD)
-- - Transferencias directas (enviadas y recibidas)
-- - Todas las transacciones donde el usuario participa
-- =========================================================

CREATE OR REPLACE FUNCTION get_user_transaction_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    transaction_type VARCHAR(20),
    amount DECIMAL(15,2),
    status VARCHAR(20),
    description TEXT,
    from_user_id UUID,
    to_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ht.id,
        ht.transaction_type,
        ht.amount,
        ht.status,
        ht.description,
        ht.from_user_id,
        ht.to_user_id,
        ht.created_at
    FROM hnld_transactions ht
    WHERE (
        -- Transacciones donde el usuario es el principal (depósitos, retiros, fees)
        ht.user_id = p_user_id 
        -- Transferencias donde el usuario es el remitente
        OR ht.from_user_id = p_user_id 
        -- Transferencias donde el usuario es el destinatario
        OR ht.to_user_id = p_user_id
    )
    -- Mostrar TODAS las transacciones del usuario, sin filtrar por status
    ORDER BY ht.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION get_user_transaction_history IS 'Obtiene el historial completo de transacciones HNLD del usuario, incluyendo depósitos, retiros, transferencias enviadas y recibidas';


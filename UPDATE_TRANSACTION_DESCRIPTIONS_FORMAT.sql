-- =========================================================
-- ACTUALIZAR FORMATO DE DESCRIPCIONES DE TRANSACCIONES HNLD
-- =========================================================
-- Este script actualiza las descripciones de las transacciones HNLD
-- para que:
-- 1. Los montos aparezcan en HNLD en lugar de L.
-- 2. Incluyan códigos únicos cuando estén disponibles
-- 3. Correspondan a la naturaleza de la transacción (compra, venta, transferencia)
-- =========================================================

-- Función auxiliar para extraer monto de descripciones antiguas
CREATE OR REPLACE FUNCTION extract_amount_from_description(desc_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Buscar patrones como "L.123.45" o "L 123.45" o "$123.45"
    IF desc_text ~* 'L\.?\s*(\d+\.?\d*)' THEN
        RETURN (regexp_match(desc_text, 'L\.?\s*(\d+\.?\d*)', 'i'))[1];
    ELSIF desc_text ~* '\$(\d+\.?\d*)' THEN
        RETURN (regexp_match(desc_text, '\$(\d+\.?\d*)', 'i'))[1];
    ELSIF desc_text ~* '€(\d+\.?\d*)' THEN
        RETURN (regexp_match(desc_text, '€(\d+\.?\d*)', 'i'))[1];
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Actualizar descripciones de transferencias directas
UPDATE hnld_transactions
SET description = CASE
    WHEN description LIKE '%Código:%' THEN
        -- Si ya tiene "Código:", extraer solo el código y reformatear
        'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
    WHEN description ~ '^[A-Z0-9-]+\s+Código:\s*[A-Z0-9-]+$' THEN
        -- Si tiene formato "CODIGO Código: CODIGO", extraer solo uno
        'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
    WHEN description ~ '^[A-Z0-9-]+$' THEN
        -- Si la descripción es solo un código sin prefijo
        'Código: ' || description
    WHEN description LIKE 'Transferencia directa de L.%' OR description LIKE 'Transferencia de L.%' OR description LIKE 'Transferencia directa de HNLD%' OR description LIKE 'Transferencia de HNLD%' THEN
        -- Buscar código en la tabla hnld_direct_transfers
        COALESCE(
            'Código: ' || (
                SELECT unique_code 
                FROM hnld_direct_transfers 
                WHERE hnld_transaction_id = hnld_transactions.id 
                LIMIT 1
            ),
            description
        )
    ELSE description
END
WHERE transaction_type = 'transfer';

-- Actualizar descripciones de compras (deposit)
UPDATE hnld_transactions
SET description = CASE
    WHEN description LIKE '%Venta de HNLD%' OR description LIKE '%Compra de HNLD%' THEN
        -- Extraer código de descripciones con formato antiguo
        CASE 
            WHEN description ~ 'Solicitud\s+([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Solicitud\s+([A-Z0-9-]+)'))[1]
            WHEN description ~ 'Código:\s*([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
            ELSE description
        END
    WHEN description LIKE 'Compra completada%' THEN
        -- Formato: "Código: [código]"
        CASE 
            WHEN description ~ 'Solicitud\s+([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Solicitud\s+([A-Z0-9-]+)'))[1]
            WHEN description ~ 'Código:\s*([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
            WHEN description ~ '^[A-Z0-9-]+$' THEN
                -- Si la descripción es solo un código sin prefijo
                'Código: ' || description
            ELSE description
        END
    WHEN description LIKE 'Depósito de L.%' OR description LIKE 'Depósito de L %' THEN
        'Compra de HNLD'
    WHEN description LIKE 'Compra con tarjeta%' OR description LIKE 'Compra de HNLD %' THEN
        CASE 
            WHEN description ~ 'Código: (.+)' THEN 
                (regexp_match(description, 'Código: (.+)'))[1]
            ELSE description
        END
    ELSE description
END
WHERE transaction_type = 'deposit'
AND (description LIKE '%L.%' OR description LIKE '%L %' OR description LIKE 'Compra completada%' OR description LIKE 'Depósito%' OR description LIKE 'Compra de HNLD%');

-- Actualizar descripciones de ventas (withdrawal)
UPDATE hnld_transactions
SET description = CASE
    WHEN description LIKE 'Retiro de L.%' OR description LIKE 'Retiro de L %' THEN
        COALESCE(
            'Código: ' || (
                SELECT sr.unique_code 
                FROM sale_requests sr 
                JOIN sale_transactions st ON st.request_id = sr.id 
                WHERE st.seller_id = hnld_transactions.user_id
                AND st.final_amount_hnld = hnld_transactions.amount
                AND ABS(EXTRACT(EPOCH FROM (st.hnld_released_at - hnld_transactions.created_at))) < 60
                LIMIT 1
            ),
            description
        )
    WHEN description LIKE '%Venta de HNLD%' THEN
        -- Extraer código de descripciones con formato "Venta de HNLD Solicitud CODIGO"
        CASE 
            WHEN description ~ 'Solicitud\s+([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Solicitud\s+([A-Z0-9-]+)'))[1]
            WHEN description ~ 'Código:\s*([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
            ELSE description
        END
    WHEN description LIKE 'Venta de HNLD - Solicitud%' OR description LIKE 'Venta de HNLD %' THEN
        CASE 
            WHEN description ~ 'Solicitud\s+([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Solicitud\s+([A-Z0-9-]+)'))[1]
            WHEN description ~ 'Código:\s*([A-Z0-9-]+)' THEN 
                'Código: ' || (regexp_match(description, 'Código:\s*([A-Z0-9-]+)'))[1]
            WHEN description ~ '^[A-Z0-9-]+$' THEN
                'Código: ' || description
            ELSE description
        END
    ELSE description
END
WHERE transaction_type = 'withdrawal';

-- Corregir transacciones de venta que están mal clasificadas como 'transfer'
-- Estas deberían ser 'withdrawal' para el vendedor
UPDATE hnld_transactions
SET transaction_type = 'withdrawal',
    description = CASE
        WHEN description LIKE '%Venta de HNLD%' THEN
            'Venta de HNLD' || E'\n' || 
            CASE 
                WHEN description ~ 'Solicitud (.+)' THEN 
                    'Solicitud ' || (regexp_match(description, 'Solicitud (.+)'))[1]
                WHEN description ~ 'Código: (.+)' THEN 
                    'Solicitud ' || (regexp_match(description, 'Código: (.+)'))[1]
                ELSE description
            END
        ELSE description
    END
WHERE transaction_type = 'transfer'
AND description LIKE '%Venta de HNLD%'
AND user_id = from_user_id;

-- Crear transacciones de compra para compradores que tienen transacciones de venta como 'transfer'
-- Estas deberían tener su propia transacción tipo 'deposit'
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
)
SELECT 
    gen_random_uuid(),
    ht.to_user_id,
    'deposit',
    ht.amount,
    'completed',
    CASE 
        WHEN ht.description ~ 'Solicitud (.+)' THEN 
            'Código: ' || (regexp_match(ht.description, 'Solicitud (.+)'))[1]
        WHEN ht.description ~ 'Código: (.+)' THEN 
            'Código: ' || (regexp_match(ht.description, 'Código: (.+)'))[1]
        WHEN ht.description ~ '^[A-Z0-9-]+$' THEN
            'Código: ' || ht.description
        ELSE ht.description
    END,
    ht.from_user_id,
    ht.to_user_id,
    ht.created_at,
    ht.updated_at
FROM hnld_transactions ht
WHERE ht.transaction_type = 'transfer'
AND ht.description LIKE '%Venta de HNLD%'
AND ht.to_user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM hnld_transactions ht2
    WHERE ht2.user_id = ht.to_user_id
    AND ht2.transaction_type = 'deposit'
    AND ht2.amount = ht.amount
    AND ht2.created_at = ht.created_at
    AND ht2.description LIKE '%Compra de HNLD%'
);

-- Limpiar función auxiliar
DROP FUNCTION IF EXISTS extract_amount_from_description(TEXT);

-- Mostrar resumen de actualizaciones
SELECT 
    transaction_type,
    COUNT(*) as total_transacciones,
    COUNT(CASE WHEN description LIKE '%HNLD%' THEN 1 END) as con_formato_hnld,
    COUNT(CASE WHEN description LIKE '%Código:%' THEN 1 END) as con_codigo
FROM hnld_transactions
GROUP BY transaction_type
ORDER BY transaction_type;


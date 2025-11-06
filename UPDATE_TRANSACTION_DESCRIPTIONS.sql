-- =========================================================
-- SCRIPT PARA ACTUALIZAR DESCRIPCIONES DE TRANSACCIONES ANTIGUAS
-- =========================================================
-- Este script actualiza las descripciones de las transacciones HNLD
-- que tienen el formato antiguo "Compra completada - Transacción XXXXXXXX"
-- al nuevo formato "Compra completada - Solicitud NMHN-YYYYMMDD-XXXXXX - Pago verificado por vendedor"
-- =========================================================

-- Función para actualizar las descripciones
DO $$
DECLARE
    transaction_record RECORD;
    transaction_id_prefix TEXT;
    request_unique_code TEXT;
    new_description TEXT;
    updated_count INTEGER := 0;
BEGIN
    -- Iterar sobre todas las transacciones HNLD que tienen el formato antiguo
    FOR transaction_record IN 
        SELECT 
            ht.id,
            ht.description,
            ht.user_id,
            ht.amount
        FROM hnld_transactions ht
        WHERE ht.description LIKE 'Compra completada - Transacción %'
        AND ht.transaction_type = 'deposit'
    LOOP
        -- Extraer el prefijo del ID de la transacción de la descripción antigua
        -- Formato: "Compra completada - Transacción XXXXXXXX"
        transaction_id_prefix := SUBSTRING(transaction_record.description FROM 'Transacción ([a-f0-9]{8})');
        
        IF transaction_id_prefix IS NOT NULL THEN
            -- Buscar la transacción de compra que tenga un ID que empiece con ese prefijo
            -- y obtener directamente el código único de la solicitud
            SELECT pr.unique_code
            INTO request_unique_code
            FROM purchase_transactions pt
            JOIN purchase_requests pr ON pr.id = pt.request_id
            WHERE pt.id::TEXT LIKE transaction_id_prefix || '%'
            LIMIT 1;
            
            -- Si encontramos el código único, actualizar la descripción
            IF request_unique_code IS NOT NULL THEN
                new_description := 'Compra completada - Solicitud ' || request_unique_code || ' - Pago verificado por vendedor';
                
                UPDATE hnld_transactions
                SET description = new_description
                WHERE id = transaction_record.id;
                
                updated_count := updated_count + 1;
                
                RAISE NOTICE 'Actualizada transacción %: % -> %', 
                    transaction_record.id, 
                    transaction_record.description, 
                    new_description;
            ELSE
                -- Intentar buscar por el user_id y el monto si no encontramos por ID
                -- Esto es un fallback para casos donde el ID no coincide exactamente
                SELECT pr.unique_code
                INTO request_unique_code
                FROM purchase_transactions pt
                JOIN purchase_requests pr ON pr.id = pt.request_id
                WHERE pt.buyer_id = transaction_record.user_id
                AND pt.status = 'completed'
                AND pt.amount = transaction_record.amount
                ORDER BY pt.funds_released_at DESC NULLS LAST, pt.updated_at DESC NULLS LAST, pt.created_at DESC
                LIMIT 1;
                
                IF request_unique_code IS NOT NULL THEN
                    new_description := 'Compra completada - Solicitud ' || request_unique_code || ' - Pago verificado por vendedor';
                    
                    UPDATE hnld_transactions
                    SET description = new_description
                    WHERE id = transaction_record.id;
                    
                    updated_count := updated_count + 1;
                    
                    RAISE NOTICE 'Actualizada transacción % (por fallback): % -> %', 
                        transaction_record.id, 
                        transaction_record.description, 
                        new_description;
                ELSE
                    RAISE NOTICE 'No se pudo encontrar transacción de compra para %', transaction_record.id;
                END IF;
            END IF;
        ELSE
            RAISE NOTICE 'No se pudo extraer el prefijo del ID de la descripción: %', transaction_record.description;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Actualización completada. Total de transacciones actualizadas: %', updated_count;
    RAISE NOTICE '========================================';
END $$;

-- Verificar los resultados
SELECT 
    COUNT(*) as total_transacciones_antiguas,
    COUNT(CASE WHEN description LIKE 'Compra completada - Solicitud %' THEN 1 END) as transacciones_actualizadas,
    COUNT(CASE WHEN description LIKE 'Compra completada - Transacción %' THEN 1 END) as transacciones_sin_actualizar
FROM hnld_transactions
WHERE description LIKE 'Compra completada%';

-- Mostrar algunas transacciones actualizadas como ejemplo
SELECT 
    id,
    user_id,
    description,
    amount,
    created_at
FROM hnld_transactions
WHERE description LIKE 'Compra completada - Solicitud %'
ORDER BY created_at DESC
LIMIT 10;


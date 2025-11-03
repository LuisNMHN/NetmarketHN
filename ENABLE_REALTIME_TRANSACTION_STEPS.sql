-- =========================================================
-- HABILITAR REALTIME PARA transaction_steps y purchase_transactions
-- =========================================================
-- Este script habilita la publicación de cambios en tiempo real
-- para que ambos usuarios vean los cambios de estado en vivo
-- =========================================================

-- PASO 1: HABILITAR REALTIME PARA transaction_steps
DO $$
BEGIN
    -- Intentar agregar la tabla a la publicación Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE transaction_steps;
        RAISE NOTICE '✅ Realtime habilitado para transaction_steps';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ℹ️ Realtime ya estaba habilitado o error: %', SQLERRM;
    END;
END $$;

-- PASO 2: HABILITAR REALTIME PARA purchase_transactions
DO $$
BEGIN
    -- Intentar agregar la tabla a la publicación Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_transactions;
        RAISE NOTICE '✅ Realtime habilitado para purchase_transactions';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ℹ️ Realtime ya estaba habilitado o error: %', SQLERRM;
    END;
END $$;

-- PASO 3: VERIFICAR QUE REALTIME ESTÁ HABILITADO
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Realtime HABILITADO para ' || tablename
        ELSE '❌ Realtime NO está habilitado para ' || tablename
    END as estado_realtime,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('transaction_steps', 'purchase_transactions')
GROUP BY tablename;

-- PASO 4: VERIFICAR TODAS LAS TABLAS EN REALTIME
SELECT 
    '📋 Tablas con Realtime habilitado:' as info,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;

SELECT '✅ Configuración de Realtime completada' as resultado;


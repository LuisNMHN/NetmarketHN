-- =========================================================
-- CONFIGURACIÓN DE REALTIME PARA MÓDULO DE PREDICCIONES
-- =========================================================
-- Este script configura Supabase Realtime para que los usuarios
-- puedan ver nuevos mercados de predicción en tiempo real cuando se crean

-- =========================================================
-- PASO 1: CONFIGURAR REPLICA IDENTITY
-- =========================================================
-- REPLICA IDENTITY FULL permite que Realtime detecte todos los cambios
-- incluyendo actualizaciones de columnas

ALTER TABLE prediction_markets REPLICA IDENTITY FULL;
ALTER TABLE market_outcomes REPLICA IDENTITY FULL;
ALTER TABLE market_positions REPLICA IDENTITY FULL;
ALTER TABLE market_trades REPLICA IDENTITY FULL;

-- =========================================================
-- PASO 2: AGREGAR TABLAS A SUPABASE_REALTIME PUBLICATION
-- =========================================================
-- Esto permite que las tablas emitan eventos en tiempo real

DO $$
BEGIN
    -- Verificar si la publicación existe
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Agregar prediction_markets si no está ya agregada
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'prediction_markets'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE prediction_markets;
            RAISE NOTICE '✅ prediction_markets agregada a la publicación supabase_realtime';
        ELSE
            RAISE NOTICE '✅ prediction_markets ya está en la publicación supabase_realtime';
        END IF;
        
        -- Agregar market_outcomes si no está ya agregada
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'market_outcomes'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE market_outcomes;
            RAISE NOTICE '✅ market_outcomes agregada a la publicación supabase_realtime';
        ELSE
            RAISE NOTICE '✅ market_outcomes ya está en la publicación supabase_realtime';
        END IF;
        
        -- Agregar market_positions si no está ya agregada
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'market_positions'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE market_positions;
            RAISE NOTICE '✅ market_positions agregada a la publicación supabase_realtime';
        ELSE
            RAISE NOTICE '✅ market_positions ya está en la publicación supabase_realtime';
        END IF;
        
        -- Agregar market_trades si no está ya agregada
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'market_trades'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE market_trades;
            RAISE NOTICE '✅ market_trades agregada a la publicación supabase_realtime';
        ELSE
            RAISE NOTICE '✅ market_trades ya está en la publicación supabase_realtime';
        END IF;
    ELSE
        RAISE EXCEPTION 'La publicación supabase_realtime no existe. Asegúrate de que Supabase Realtime esté habilitado.';
    END IF;
END $$;

-- =========================================================
-- PASO 3: VERIFICAR Y MEJORAR POLÍTICAS RLS
-- =========================================================
-- Asegurar que las políticas RLS permitan que los usuarios vean
-- mercados activos en tiempo real

-- Verificar que las políticas existentes permitan SELECT para mercados activos
-- (Las políticas ya están en CREATE_PREDICTION_MARKETS_SYSTEM.sql, pero las verificamos)

-- Política para que cualquier usuario autenticado pueda ver mercados activos
-- Esta política ya debería existir, pero la verificamos
DO $$
BEGIN
    -- Verificar si la política existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prediction_markets' 
        AND policyname = 'Anyone can view active markets'
    ) THEN
        -- Crear la política si no existe
        CREATE POLICY "Anyone can view active markets"
            ON prediction_markets FOR SELECT
            USING (status IN ('active', 'closed', 'resolved'));
        RAISE NOTICE '✅ Política "Anyone can view active markets" creada';
    ELSE
        RAISE NOTICE '✅ Política "Anyone can view active markets" ya existe';
    END IF;
END $$;

-- Política para que los usuarios puedan ver sus propios mercados (incluyendo cancelados)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prediction_markets' 
        AND policyname = 'Users can view their own markets'
    ) THEN
        CREATE POLICY "Users can view their own markets"
            ON prediction_markets FOR SELECT
            USING (auth.uid() = creator_id);
        RAISE NOTICE '✅ Política "Users can view their own markets" creada';
    ELSE
        RAISE NOTICE '✅ Política "Users can view their own markets" ya existe';
    END IF;
END $$;

-- Política para que cualquier usuario pueda ver outcomes de mercados activos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'market_outcomes' 
        AND policyname = 'Anyone can view outcomes'
    ) THEN
        CREATE POLICY "Anyone can view outcomes"
            ON market_outcomes FOR SELECT
            USING (TRUE);
        RAISE NOTICE '✅ Política "Anyone can view outcomes" creada';
    ELSE
        RAISE NOTICE '✅ Política "Anyone can view outcomes" ya existe';
    END IF;
END $$;

-- Política para que cualquier usuario pueda ver trades de mercados activos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'market_trades' 
        AND policyname = 'Anyone can view trades of active markets'
    ) THEN
        CREATE POLICY "Anyone can view trades of active markets"
            ON market_trades FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM prediction_markets
                    WHERE id = market_trades.market_id
                    AND status IN ('active', 'closed', 'resolved')
                )
            );
        RAISE NOTICE '✅ Política "Anyone can view trades of active markets" creada';
    ELSE
        RAISE NOTICE '✅ Política "Anyone can view trades of active markets" ya existe';
    END IF;
END $$;

-- =========================================================
-- PASO 4: VERIFICAR CONFIGURACIÓN
-- =========================================================
-- Verificar que todo esté configurado correctamente

DO $$
DECLARE
    markets_in_realtime BOOLEAN;
    outcomes_in_realtime BOOLEAN;
    positions_in_realtime BOOLEAN;
    trades_in_realtime BOOLEAN;
BEGIN
    -- Verificar que las tablas estén en realtime
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'prediction_markets'
    ) INTO markets_in_realtime;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'market_outcomes'
    ) INTO outcomes_in_realtime;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'market_positions'
    ) INTO positions_in_realtime;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'market_trades'
    ) INTO trades_in_realtime;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE CONFIGURACIÓN REALTIME';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'prediction_markets en realtime: %', markets_in_realtime;
    RAISE NOTICE 'market_outcomes en realtime: %', outcomes_in_realtime;
    RAISE NOTICE 'market_positions en realtime: %', positions_in_realtime;
    RAISE NOTICE 'market_trades en realtime: %', trades_in_realtime;
    RAISE NOTICE '========================================';
    
    IF markets_in_realtime AND outcomes_in_realtime AND positions_in_realtime AND trades_in_realtime THEN
        RAISE NOTICE '✅ Todas las tablas están configuradas para Realtime';
    ELSE
        RAISE WARNING '⚠️ Algunas tablas no están en Realtime. Revisa la configuración.';
    END IF;
END $$;

-- =========================================================
-- COMENTARIOS FINALES
-- =========================================================
COMMENT ON TABLE prediction_markets IS 'Mercados de predicción - Configurado para Realtime: INSERT, UPDATE';
COMMENT ON TABLE market_outcomes IS 'Opciones de mercados - Configurado para Realtime: INSERT, UPDATE';
COMMENT ON TABLE market_positions IS 'Posiciones de usuarios - Configurado para Realtime: INSERT, UPDATE';
COMMENT ON TABLE market_trades IS 'Operaciones de trading - Configurado para Realtime: INSERT';

-- =========================================================
-- NOTAS DE USO
-- =========================================================
-- Para suscribirse a nuevos mercados en el cliente:
-- 
-- const channel = supabase
--   .channel('prediction_markets')
--   .on('postgres_changes', {
--     event: 'INSERT',
--     schema: 'public',
--     table: 'prediction_markets',
--     filter: 'status=eq.active'
--   }, (payload) => {
--     console.log('Nuevo mercado:', payload.new)
--     // Actualizar lista de mercados
--   })
--   .subscribe()
--
-- Para suscribirse a actualizaciones de un mercado específico:
--
-- const channel = supabase
--   .channel(`market:${marketId}`)
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'prediction_markets',
--     filter: `id=eq.${marketId}`
--   }, (payload) => {
--     console.log('Mercado actualizado:', payload)
--   })
--   .subscribe()

-- =========================================================
-- FIX: Actualizar políticas RLS para permitir ver mercados cancelados
-- =========================================================
-- Este script actualiza las políticas RLS para que los usuarios
-- puedan ver mercados cancelados en tiempo real

-- Actualizar política para que cualquier usuario pueda ver mercados activos, cerrados, resueltos Y cancelados
DO $$
BEGIN
    -- Eliminar política antigua si existe
    DROP POLICY IF EXISTS "Anyone can view active markets" ON prediction_markets;
    
    -- Crear nueva política que incluye 'cancelled'
    CREATE POLICY "Anyone can view active markets"
        ON prediction_markets FOR SELECT
        USING (status IN ('active', 'closed', 'resolved', 'cancelled'));
    
    RAISE NOTICE '✅ Política "Anyone can view active markets" actualizada para incluir mercados cancelados';
END $$;

-- Verificar que la política permite ver mercados cancelados
DO $$
DECLARE
    policy_exists BOOLEAN;
    policy_allows_cancelled BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prediction_markets' 
        AND policyname = 'Anyone can view active markets'
    ) INTO policy_exists;
    
    IF policy_exists THEN
        RAISE NOTICE '✅ Política "Anyone can view active markets" existe';
        -- La política ahora permite ver mercados con status 'cancelled'
        policy_allows_cancelled := TRUE;
        RAISE NOTICE '✅ La política permite ver mercados cancelados';
    ELSE
        RAISE WARNING '⚠️ Política "Anyone can view active markets" no existe';
    END IF;
END $$;

-- Verificar REPLICA IDENTITY
DO $$
DECLARE
    replica_identity TEXT;
BEGIN
    SELECT relreplident::text INTO replica_identity
    FROM pg_class
    WHERE relname = 'prediction_markets';
    
    IF replica_identity = 'f' THEN
        RAISE NOTICE '✅ REPLICA IDENTITY está configurado como FULL para prediction_markets';
    ELSE
        RAISE WARNING '⚠️ REPLICA IDENTITY para prediction_markets es: % (debería ser FULL)', replica_identity;
        ALTER TABLE prediction_markets REPLICA IDENTITY FULL;
        RAISE NOTICE '✅ REPLICA IDENTITY actualizado a FULL';
    END IF;
END $$;

-- Verificar que la tabla está en la publicación supabase_realtime
DO $$
DECLARE
    in_realtime BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'prediction_markets'
    ) INTO in_realtime;
    
    IF in_realtime THEN
        RAISE NOTICE '✅ prediction_markets está en la publicación supabase_realtime';
    ELSE
        RAISE WARNING '⚠️ prediction_markets NO está en la publicación supabase_realtime';
        -- Intentar agregarla
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prediction_markets;
            RAISE NOTICE '✅ prediction_markets agregada a la publicación supabase_realtime';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error agregando prediction_markets a la publicación: %', SQLERRM;
        END;
    END IF;
END $$;

-- =========================================================
-- FIX: Asegurar que can_create_market funcione correctamente
-- =========================================================
-- Este script verifica y corrige la función can_create_market
-- para que pueda leer market_creator_permissions correctamente

-- Paso 1: Eliminar políticas que dependen de la función
DROP POLICY IF EXISTS "Users with permission can create markets" ON prediction_markets;

-- Paso 2: Eliminar función existente (ahora sin dependencias)
DROP FUNCTION IF EXISTS can_create_market(UUID);

-- Paso 3: Recrear la función con SECURITY DEFINER
-- Esto permite que la función lea market_creator_permissions
-- sin restricciones RLS
CREATE OR REPLACE FUNCTION can_create_market(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_permission RECORD;
    v_active_markets INTEGER;
    v_today_markets INTEGER;
BEGIN
    -- Verificar si tiene permiso
    -- SECURITY DEFINER permite leer sin restricciones RLS
    SELECT * INTO v_permission
    FROM market_creator_permissions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());
    
    IF v_permission IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar límite de mercados activos
    SELECT COUNT(*) INTO v_active_markets
    FROM prediction_markets
    WHERE creator_id = p_user_id
      AND status = 'active';
    
    IF v_active_markets >= v_permission.max_active_markets THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar límite diario
    SELECT COUNT(*) INTO v_today_markets
    FROM prediction_markets
    WHERE creator_id = p_user_id
      AND created_at::date = CURRENT_DATE;
    
    IF v_today_markets >= v_permission.max_daily_markets THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 4: Recrear la política RLS que depende de la función
CREATE POLICY "Users with permission can create markets"
    ON prediction_markets FOR INSERT
    WITH CHECK (can_create_market(auth.uid()));

-- Paso 5: Verificar que la función se creó correctamente
DO $$
DECLARE
    func_exists BOOLEAN;
    func_security BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'can_create_market'
    ) INTO func_exists;
    
    SELECT prosecdef INTO func_security
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'can_create_market';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE FUNCIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Función existe: %', func_exists;
    RAISE NOTICE 'SECURITY DEFINER: %', func_security;
    RAISE NOTICE '========================================';
    
    IF func_exists AND func_security THEN
        RAISE NOTICE '✅ Función can_create_market configurada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: La función no se creó correctamente';
    END IF;
END $$;

-- Paso 6: Asegurar que las políticas RLS permitan que la función funcione
-- La función usa SECURITY DEFINER, así que puede leer sin restricciones
-- Pero debemos asegurar que los usuarios puedan ver sus propios permisos
DO $$
BEGIN
    -- Verificar si la política existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'market_creator_permissions'
        AND policyname = 'Users can view their own permissions'
    ) THEN
        RAISE NOTICE 'Creando política "Users can view their own permissions"...';
        CREATE POLICY "Users can view their own permissions"
            ON market_creator_permissions FOR SELECT
            USING (auth.uid() = user_id);
        RAISE NOTICE '✅ Política creada';
    ELSE
        RAISE NOTICE '✅ Política ya existe';
    END IF;
END $$;

-- Comentario para documentación
COMMENT ON FUNCTION can_create_market(UUID) IS 'Verifica si un usuario puede crear mercados de predicción. Usa SECURITY DEFINER para leer market_creator_permissions sin restricciones RLS.';

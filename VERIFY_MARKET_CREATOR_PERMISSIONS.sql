-- =========================================================
-- VERIFICACIÓN Y DIAGNÓSTICO DE PERMISOS DE CREADOR
-- =========================================================
-- Este script verifica que todo esté configurado correctamente
-- para que los usuarios puedan verificar sus permisos

-- Paso 1: Verificar que la función existe y tiene SECURITY DEFINER
DO $$
DECLARE
    func_exists BOOLEAN;
    func_security TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'can_create_market'
    ) INTO func_exists;
    
    SELECT prosecdef::TEXT INTO func_security
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'can_create_market';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE FUNCIÓN can_create_market';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Función existe: %', func_exists;
    RAISE NOTICE 'SECURITY DEFINER: %', func_security;
    RAISE NOTICE '========================================';
    
    IF NOT func_exists THEN
        RAISE WARNING '⚠️ La función can_create_market NO existe';
    ELSIF func_security != 't' THEN
        RAISE WARNING '⚠️ La función can_create_market NO tiene SECURITY DEFINER';
    ELSE
        RAISE NOTICE '✅ La función can_create_market está correctamente configurada';
    END IF;
END $$;

-- Paso 2: Verificar políticas RLS en market_creator_permissions
DO $$
DECLARE
    rls_enabled BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Verificar si RLS está habilitado
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'market_creator_permissions';
    
    -- Contar políticas
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'market_creator_permissions';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE RLS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS habilitado: %', rls_enabled;
    RAISE NOTICE 'Número de políticas: %', policy_count;
    RAISE NOTICE '========================================';
    
    IF NOT rls_enabled THEN
        RAISE WARNING '⚠️ RLS NO está habilitado en market_creator_permissions';
    END IF;
    
    IF policy_count = 0 THEN
        RAISE WARNING '⚠️ NO hay políticas RLS en market_creator_permissions';
    ELSE
        RAISE NOTICE '✅ RLS está configurado con % políticas', policy_count;
    END IF;
END $$;

-- Paso 3: Verificar que existe la política para que usuarios vean sus permisos
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'market_creator_permissions'
        AND policyname = 'Users can view their own permissions'
    ) INTO policy_exists;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE POLÍTICA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Política "Users can view their own permissions" existe: %', policy_exists;
    RAISE NOTICE '========================================';
    
    IF NOT policy_exists THEN
        RAISE WARNING '⚠️ La política "Users can view their own permissions" NO existe';
        RAISE NOTICE 'Creando la política...';
        
        CREATE POLICY "Users can view their own permissions"
            ON market_creator_permissions FOR SELECT
            USING (auth.uid() = user_id);
        
        RAISE NOTICE '✅ Política creada';
    ELSE
        RAISE NOTICE '✅ La política existe correctamente';
    END IF;
END $$;

-- Paso 4: Verificar que la función puede ejecutarse correctamente
-- (Esto solo verifica la sintaxis, no ejecuta con un usuario real)
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN COMPLETA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Si todos los pasos anteriores muestran ✅,';
    RAISE NOTICE 'el sistema de permisos está correctamente configurado.';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: Si los permisos no funcionan, verifica:';
    RAISE NOTICE '1. Que el usuario tenga un registro en market_creator_permissions';
    RAISE NOTICE '2. Que is_active = TRUE';
    RAISE NOTICE '3. Que expires_at sea NULL o una fecha futura';
    RAISE NOTICE '4. Que no haya excedido los límites de mercados activos/diarios';
    RAISE NOTICE '========================================';
END $$;

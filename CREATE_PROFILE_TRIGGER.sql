-- =========================================================
-- NMHN - TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
-- =========================================================

-- 1. Crear función para manejar la creación automática de perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar en la tabla profiles
  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    email = NEW.email,
    updated_at = NEW.updated_at;

  -- Insertar en la tabla user_profiles (si existe)
  INSERT INTO public.user_profiles (user_id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    updated_at = NEW.updated_at;

  RETURN NEW;
END;
$$;

-- 2. Crear trigger que se ejecuta después de insertar un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Verificar que el trigger se creó correctamente
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 4. Comentarios para documentación
COMMENT ON FUNCTION public.handle_new_user() IS 'Función que crea automáticamente un perfil cuando se registra un nuevo usuario';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Trigger que ejecuta handle_new_user() después de insertar un usuario';

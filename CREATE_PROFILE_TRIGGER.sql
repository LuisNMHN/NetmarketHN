-- =========================================================
-- NMHN - FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE
-- =========================================================

-- 1. Crear función para manejar la creación automática de perfil
-- Esta función se ejecutará desde el código de la aplicación
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Insertar en la tabla profiles
  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (
    p_user_id,
    COALESCE(p_full_name, p_email),
    p_email,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, p_email),
    email = p_email,
    updated_at = now();

  -- Insertar en la tabla user_profiles (si existe)
  INSERT INTO public.user_profiles (user_id, display_name, created_at, updated_at)
  VALUES (
    p_user_id,
    COALESCE(p_full_name, p_email),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(p_full_name, p_email),
    updated_at = now();

  -- Asignar rol 'user' por defecto
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'user';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id, created_at)
    VALUES (p_user_id, v_role_id, now())
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END;
$$;

-- 2. Crear función para verificar si un usuario tiene perfil
CREATE OR REPLACE FUNCTION public.user_has_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id
  );
END;
$$;

-- 3. Crear función para obtener información del usuario
CREATE OR REPLACE FUNCTION public.get_user_info(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  has_profile boolean,
  roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_user_id,
    p.email,
    p.full_name,
    public.user_has_profile(p_user_id),
    COALESCE(
      ARRAY(
        SELECT r.name 
        FROM public.user_roles ur 
        JOIN public.roles r ON r.id = ur.role_id 
        WHERE ur.user_id = p_user_id
      ),
      ARRAY[]::text[]
    )
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- 4. Comentarios para documentación
COMMENT ON FUNCTION public.create_user_profile IS 'Función para crear perfil de usuario con rol por defecto';
COMMENT ON FUNCTION public.user_has_profile IS 'Función para verificar si un usuario tiene perfil';
COMMENT ON FUNCTION public.get_user_info IS 'Función para obtener información completa del usuario';

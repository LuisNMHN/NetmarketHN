-- Script completo para crear la tabla user_profiles compatible con la página de perfil
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Crear la tabla user_profiles con todos los campos necesarios
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información básica
  display_name TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  avatar_url TEXT,
  
  -- Información adicional
  birth_date DATE,
  country TEXT,
  website TEXT,
  phone TEXT, -- Campo agregado para compatibilidad con la página de perfil
  
  -- Configuración de aplicación
  theme TEXT CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  
  -- Configuraciones de privacidad y notificaciones
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  notification_sms BOOLEAN DEFAULT false,
  
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Índices únicos
  UNIQUE(user_id)
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS
-- Los usuarios solo pueden ver y editar su propio perfil
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Crear trigger para actualizar updated_at
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Crear función para migrar datos existentes (opcional)
CREATE OR REPLACE FUNCTION migrate_existing_profiles()
RETURNS void AS $$
BEGIN
  INSERT INTO user_profiles (user_id, display_name, bio, country, avatar_url, theme, phone)
  SELECT 
    p.id as user_id,
    p.full_name as display_name,
    '' as bio,
    'Honduras' as country,
    NULL as avatar_url,
    'system' as theme,
    NULL as phone
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = p.id
  );
END;
$$ language 'plpgsql';

-- 7. Ejecutar migración (comentar si no es necesario)
-- SELECT migrate_existing_profiles();

-- 8. Verificar que la tabla se creó correctamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- 9. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 10. Comentarios adicionales para documentación
COMMENT ON TABLE user_profiles IS 'Tabla de perfiles de usuario extendida con preferencias y configuraciones';
COMMENT ON COLUMN user_profiles.phone IS 'Número de teléfono del usuario para contactos importantes';
COMMENT ON COLUMN user_profiles.display_name IS 'Nombre para mostrar del usuario (puede ser diferente al nombre legal)';
COMMENT ON COLUMN user_profiles.theme IS 'Tema de interfaz preferido: light, dark, o system';
COMMENT ON COLUMN user_profiles.notification_email IS 'Preferencia para recibir notificaciones por correo electrónico';
COMMENT ON COLUMN user_profiles.notification_push IS 'Preferencia para recibir notificaciones push';
COMMENT ON COLUMN user_profiles.notification_sms IS 'Preferencia para recibir notificaciones por SMS';

-- 11. Crear índices adicionales para optimización (opcional)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_theme ON user_profiles(theme);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- 12. Verificar que todo se creó correctamente
SELECT 
  'user_profiles' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'user_profiles';

-- 13. Mostrar resumen de la estructura
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

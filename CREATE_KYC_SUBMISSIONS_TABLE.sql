-- =========================================================
-- NMHN - TABLA KYC_SUBMISSIONS
-- =========================================================
-- Script para crear la tabla kyc_submissions con todos los campos necesarios

-- 1. Crear la tabla kyc_submissions
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información personal
  full_name TEXT,
  birth_date DATE,
  country TEXT DEFAULT 'Honduras',
  
  -- Información del documento
  doc_type TEXT,
  doc_number TEXT,
  
  -- Información de dirección
  address_department TEXT,
  address_city TEXT,
  address_neighborhood TEXT,
  address_desc TEXT,
  
  -- Rutas de archivos subidos
  document_front_path TEXT,
  document_back_path TEXT,
  selfie_path TEXT,
  address_proof_path TEXT,
  
  -- Estado de la verificación
  status TEXT CHECK (status IN ('draft', 'review', 'approved', 'rejected')) DEFAULT 'draft',
  
  -- Notas del administrador
  admin_notes TEXT,
  
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Índices únicos
  UNIQUE(user_id)
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS
-- Los usuarios solo pueden ver y editar su propia verificación
CREATE POLICY "Users can view own kyc submission" ON kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kyc submission" ON kyc_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kyc submission" ON kyc_submissions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own kyc submission" ON kyc_submissions
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_kyc_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Crear trigger para actualizar updated_at
CREATE TRIGGER update_kyc_submissions_updated_at 
  BEFORE UPDATE ON kyc_submissions 
  FOR EACH ROW EXECUTE FUNCTION update_kyc_submissions_updated_at();

-- 6. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_updated_at ON kyc_submissions(updated_at);

-- 7. Comentarios para documentación
COMMENT ON TABLE kyc_submissions IS 'Tabla de envíos de verificación KYC (Know Your Customer)';
COMMENT ON COLUMN kyc_submissions.user_id IS 'ID del usuario que envía la verificación';
COMMENT ON COLUMN kyc_submissions.full_name IS 'Nombre completo del usuario';
COMMENT ON COLUMN kyc_submissions.birth_date IS 'Fecha de nacimiento del usuario';
COMMENT ON COLUMN kyc_submissions.country IS 'País del usuario (por defecto Honduras)';
COMMENT ON COLUMN kyc_submissions.doc_type IS 'Tipo de documento de identidad';
COMMENT ON COLUMN kyc_submissions.doc_number IS 'Número del documento de identidad';
COMMENT ON COLUMN kyc_submissions.address_department IS 'Departamento de residencia';
COMMENT ON COLUMN kyc_submissions.address_city IS 'Ciudad de residencia';
COMMENT ON COLUMN kyc_submissions.address_neighborhood IS 'Colonia/Barrio/Aldea de residencia';
COMMENT ON COLUMN kyc_submissions.address_desc IS 'Descripción detallada de la dirección';
COMMENT ON COLUMN kyc_submissions.document_front_path IS 'Ruta del archivo del documento frontal';
COMMENT ON COLUMN kyc_submissions.document_back_path IS 'Ruta del archivo del documento reverso';
COMMENT ON COLUMN kyc_submissions.selfie_path IS 'Ruta del archivo de la selfie';
COMMENT ON COLUMN kyc_submissions.address_proof_path IS 'Ruta del archivo del comprobante de domicilio';
COMMENT ON COLUMN kyc_submissions.status IS 'Estado de la verificación: draft, review, approved, rejected';
COMMENT ON COLUMN kyc_submissions.admin_notes IS 'Notas del administrador sobre la verificación';

-- 8. Verificar que la tabla se creó correctamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'kyc_submissions' 
ORDER BY ordinal_position;

-- 9. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'kyc_submissions';

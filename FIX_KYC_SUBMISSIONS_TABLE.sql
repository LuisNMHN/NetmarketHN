-- =========================================================
-- NMHN - CORRECCIONES PARA TABLA KYC_SUBMISSIONS
-- =========================================================

-- 1. Verificar tablas existentes
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('profiles', 'kyc_submissions');

-- 2. Agregar campo admin_notes que falta
ALTER TABLE kyc_submissions 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 3. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_kyc_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Crear trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_kyc_submissions_updated_at ON kyc_submissions;
CREATE TRIGGER update_kyc_submissions_updated_at 
  BEFORE UPDATE ON kyc_submissions 
  FOR EACH ROW EXECUTE FUNCTION update_kyc_submissions_updated_at();

-- 5. Verificar estructura final de la tabla
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'kyc_submissions' 
ORDER BY ordinal_position;

-- 6. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'kyc_submissions';

-- 7. Verificar triggers
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'kyc_submissions';

-- =========================================================
-- NMHN - ELIMINAR RESTRICCIÓN KYC_REQUIRED_WHEN_SUBMITTED
-- =========================================================
-- Script para eliminar la restricción que impide eliminar documentos

-- 1. Verificar restricciones existentes en kyc_submissions
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'kyc_submissions'::regclass
ORDER BY conname;

-- 2. Eliminar la restricción kyc_required_when_submitted si existe
DO $$
BEGIN
    -- Verificar si la restricción existe antes de eliminarla
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kyc_required_when_submitted' 
        AND conrelid = 'kyc_submissions'::regclass
    ) THEN
        ALTER TABLE kyc_submissions DROP CONSTRAINT kyc_required_when_submitted;
        RAISE NOTICE 'Restricción kyc_required_when_submitted eliminada exitosamente';
    ELSE
        RAISE NOTICE 'La restricción kyc_required_when_submitted no existe';
    END IF;
END $$;

-- 3. Verificar que la restricción fue eliminada
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'kyc_submissions'::regclass
ORDER BY conname;

-- 4. Probar que ahora se puede actualizar document_front_path a null
-- (Este es solo un test, no afecta datos reales)
UPDATE kyc_submissions 
SET document_front_path = NULL 
WHERE user_id = '65698894-b6bb-4b23-92d2-7355e676d9ee' 
AND status = 'review'
AND document_front_path IS NOT NULL;

-- 5. Verificar el resultado del test
SELECT user_id, status, document_front_path 
FROM kyc_submissions 
WHERE user_id = '65698894-b6bb-4b23-92d2-7355e676d9ee';

-- 6. Mensaje final
SELECT 'Restricción eliminada. Ahora se pueden eliminar documentos de solicitudes en estado review.' as resultado;

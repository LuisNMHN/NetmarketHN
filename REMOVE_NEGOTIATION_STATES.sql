-- =========================================================
-- ELIMINACIÓN COMPLETA DE LA LÓGICA DE ESTADOS DE NEGOCIACIÓN
-- =========================================================
-- Este script elimina todos los campos, funciones y políticas
-- relacionadas con el sistema de estados de negociación
-- =========================================================

-- =========================================================
-- 1. ELIMINAR FUNCIONES DE NEGOCIACIÓN
-- =========================================================

-- Eliminar función start_negotiation
DROP FUNCTION IF EXISTS start_negotiation(UUID, UUID);

-- Eliminar función end_negotiation_no_deal
DROP FUNCTION IF EXISTS end_negotiation_no_deal(UUID, UUID);

-- Eliminar función accept_offer_during_negotiation
DROP FUNCTION IF EXISTS accept_offer_during_negotiation(UUID, UUID, DECIMAL, TEXT);

-- Eliminar función cleanup_expired_negotiations
DROP FUNCTION IF EXISTS cleanup_expired_negotiations();

-- =========================================================
-- 2. ELIMINAR POLÍTICAS RLS QUE DEPENDEN DE CAMPOS DE NEGOCIACIÓN
-- =========================================================

-- Eliminar políticas RLS que dependían de campos de negociación
DROP POLICY IF EXISTS "Users can view available purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view requests they are negotiating" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view their own requests or ones they are negotiating" ON purchase_requests;
DROP POLICY IF EXISTS "Users can view requests where they are negotiating" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update requests they are negotiating" ON purchase_requests;

-- =========================================================
-- 3. ELIMINAR CAMPOS DE NEGOCIACIÓN DE LA TABLA
-- =========================================================

-- Eliminar campos de negociación de purchase_requests
ALTER TABLE purchase_requests 
DROP COLUMN IF EXISTS negotiating_with,
DROP COLUMN IF EXISTS negotiation_started_at,
DROP COLUMN IF EXISTS negotiation_timeout_at;

-- =========================================================
-- 4. LIMPIAR DATOS EXISTENTES ANTES DE CAMBIAR CONSTRAINT
-- =========================================================

-- Cambiar todas las solicitudes en estado 'negotiating' a 'active'
UPDATE purchase_requests 
SET status = 'active', updated_at = NOW()
WHERE status = 'negotiating';

-- Cambiar cualquier estado inválido a 'active' (por seguridad)
UPDATE purchase_requests 
SET status = 'active', updated_at = NOW()
WHERE status NOT IN ('active', 'accepted', 'completed', 'cancelled', 'expired');

-- =========================================================
-- 5. ACTUALIZAR CONSTRAINT DE ESTADOS
-- =========================================================

-- Eliminar constraint existente de estados
ALTER TABLE purchase_requests 
DROP CONSTRAINT IF EXISTS purchase_requests_status_check;

-- Crear nuevo constraint sin estado 'negotiating'
ALTER TABLE purchase_requests 
ADD CONSTRAINT purchase_requests_status_check 
CHECK (status IN ('active', 'accepted', 'completed', 'cancelled', 'expired'));

-- =========================================================
-- 6. ELIMINAR ÍNDICES RELACIONADOS CON NEGOCIACIÓN
-- =========================================================

-- Eliminar índices de negociación si existen
DROP INDEX IF EXISTS idx_purchase_requests_negotiating_with;
DROP INDEX IF EXISTS idx_purchase_requests_negotiation_timeout;
DROP INDEX IF EXISTS idx_purchase_requests_status_negotiating;

-- =========================================================
-- 7. RECREAR POLÍTICAS RLS BÁSICAS (SIN CAMPOS DE NEGOCIACIÓN)
-- =========================================================

-- Política para ver solicitudes activas (sin restricciones de negociación)
CREATE POLICY "Users can view active purchase requests" ON purchase_requests
FOR SELECT USING (status = 'active');

-- Política para que los usuarios vean sus propias solicitudes
CREATE POLICY "Users can view their own requests" ON purchase_requests
FOR SELECT USING (buyer_id = auth.uid());

-- Política para que los usuarios actualicen sus propias solicitudes
CREATE POLICY "Users can update their own requests" ON purchase_requests
FOR UPDATE USING (buyer_id = auth.uid());

-- Política para que los usuarios eliminen sus propias solicitudes
CREATE POLICY "Users can delete their own requests" ON purchase_requests
FOR DELETE USING (buyer_id = auth.uid());

-- =========================================================
-- 8. VERIFICACIÓN Y LIMPIEZA FINAL
-- =========================================================

-- Verificar que no queden solicitudes en estado 'negotiating'
SELECT 
    COUNT(*) as solicitudes_en_negociacion,
    'Debería ser 0' as esperado
FROM purchase_requests 
WHERE status = 'negotiating';

-- Verificar que no existan campos de negociación
SELECT 
    column_name,
    'Campo de negociación encontrado' as problema
FROM information_schema.columns 
WHERE table_name = 'purchase_requests' 
AND column_name IN ('negotiating_with', 'negotiation_started_at', 'negotiation_timeout_at');

-- Mostrar estados actuales de solicitudes
SELECT 
    status,
    COUNT(*) as cantidad
FROM purchase_requests 
GROUP BY status
ORDER BY status;

-- =========================================================
-- 9. COMENTARIOS DE VERIFICACIÓN
-- =========================================================

-- Verificar que las funciones fueron eliminadas
SELECT 
    routine_name,
    'Función de negociación encontrada' as problema
FROM information_schema.routines 
WHERE routine_name IN (
    'start_negotiation',
    'end_negotiation_no_deal', 
    'accept_offer_during_negotiation',
    'cleanup_expired_negotiations'
);

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Este script elimina COMPLETAMENTE la lógica de estados de negociación
-- 2. Todas las solicitudes en estado 'negotiating' se convertirán a 'active'
-- 3. Los campos de negociación se eliminan permanentemente
-- 4. Las funciones de negociación se eliminan completamente
-- 5. Se actualiza el constraint de estados para excluir 'negotiating'
-- 6. Se eliminan índices y políticas relacionadas
-- =========================================================

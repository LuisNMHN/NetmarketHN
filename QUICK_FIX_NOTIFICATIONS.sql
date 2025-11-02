-- =========================================================
-- CORRECCIÓN RÁPIDA: Tipos de notificación faltantes
-- =========================================================
-- Ejecuta este script para corregir el error inmediatamente
-- =========================================================

-- Eliminar constraint existente
ALTER TABLE request_notifications 
DROP CONSTRAINT IF EXISTS request_notifications_type_check;

-- Crear nuevo constraint con todos los tipos
ALTER TABLE request_notifications 
ADD CONSTRAINT request_notifications_type_check 
CHECK (type IN (
    'new_request',
    'new_offer', 
    'offer_accepted',
    'offer_rejected',
    'payment_sent',
    'payment_confirmed',
    'transaction_completed',
    'request_expired',
    'request_cancelled',
    -- Nuevos tipos de negociación
    'negotiation_started',
    'negotiation_ended',
    'negotiation_expired'
));

-- Verificar que se aplicó correctamente
SELECT 'Constraint actualizado correctamente' as resultado;






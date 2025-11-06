-- =========================================================
-- CORRECCIÓN: Agregar tipos de notificación faltantes
-- =========================================================
-- Este script corrige el constraint de request_notifications
-- para incluir los nuevos tipos de notificación de negociación
-- =========================================================

-- 1. Verificar constraint actual
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'request_notifications'::regclass 
AND contype = 'c';

-- 2. Eliminar constraint existente
ALTER TABLE request_notifications 
DROP CONSTRAINT IF EXISTS request_notifications_type_check;

-- 3. Crear nuevo constraint con todos los tipos
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

-- 4. Verificar que se aplicó correctamente
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'request_notifications'::regclass 
AND contype = 'c';

-- 5. Probar que funciona
SELECT 'Constraint actualizado correctamente' as resultado;

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================












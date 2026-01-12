-- =========================================================
-- ACTUALIZAR SISTEMA DE NOTIFICACIONES PARA PREDICCIONES
-- =========================================================
-- Agrega el topic 'prediction' al sistema de notificaciones
-- para integrar notificaciones del módulo de predicciones

-- Paso 1: Eliminar el constraint CHECK existente
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_topic_check;

-- Paso 2: Agregar el nuevo constraint con 'prediction' incluido
ALTER TABLE notifications ADD CONSTRAINT notifications_topic_check 
  CHECK (topic IN ('order', 'kyc', 'wallet', 'chat', 'system', 'prediction'));

-- Paso 3: Actualizar comentarios
COMMENT ON COLUMN notifications.topic IS 'Categoría de la notificación: order, kyc, wallet, chat, system, prediction';

-- Verificar que el cambio se aplicó correctamente
DO $$
BEGIN
  RAISE NOTICE '✅ Topic "prediction" agregado al sistema de notificaciones';
END $$;

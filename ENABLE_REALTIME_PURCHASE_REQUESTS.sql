-- =========================================================
-- HABILITAR REALTIME PARA purchase_requests
-- =========================================================

-- Habilitar la publicación de cambios en tiempo real para purchase_requests
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_requests;

-- Verificar que la tabla está en el catálogo de replicación
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'purchase_requests';

-- Verificar la configuración de la publicación
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

SELECT 'Realtime habilitado para purchase_requests' as resultado;


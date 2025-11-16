-- HABILITAR REALTIME PARA SALE_REQUESTS
-- Ejecuta esto y luego recarga la página

ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;

-- Verificar
SELECT 'sale_requests' as tabla, 
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_publication_tables 
         WHERE pubname = 'supabase_realtime' 
         AND tablename = 'sale_requests'
       ) THEN '✅ HABILITADO' ELSE '❌ NO HABILITADO' END as estado;


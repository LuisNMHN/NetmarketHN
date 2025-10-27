-- =========================================================
-- FIX: Corregir función open_or_get_thread para buscar threads correctamente
-- =========================================================

-- Primero, crear el enum si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_context_type') THEN
        CREATE TYPE chat_context_type AS ENUM ('order', 'auction', 'ticket', 'dispute');
    END IF;
END $$;

-- Eliminar TODAS las funciones con cualquier firma
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as sig FROM pg_proc WHERE proname = 'open_or_get_thread') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proname || '(' || r.sig || ') CASCADE';
    END LOOP;
END $$;

-- Verificar que la tabla chat_threads existe
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type chat_context_type NOT NULL,
    context_id TEXT NOT NULL,
    party_a UUID NOT NULL,
    party_b UUID NOT NULL,
    context_title TEXT,
    context_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Si la tabla ya existe con TEXT, cambiarla
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_threads' AND column_name = 'context_type' AND data_type = 'character varying') THEN
        ALTER TABLE chat_threads ALTER COLUMN context_type TYPE chat_context_type USING context_type::chat_context_type;
    END IF;
END $$;

-- Verificar que la tabla chat_read_status existe
CREATE TABLE IF NOT EXISTS chat_read_status (
    thread_id UUID NOT NULL,
    user_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

-- Recrear función con parámetros nombrados explícitamente
CREATE OR REPLACE FUNCTION open_or_get_thread(
    p_context_data JSONB,
    p_context_id TEXT,
    p_context_title TEXT,
    p_context_type chat_context_type,
    p_party_a UUID,
    p_party_b UUID
)
RETURNS UUID AS $$
DECLARE
    thread_id UUID;
    existing_thread_id UUID;
BEGIN
    -- Verificar que los usuarios existen
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_party_a) THEN
        RAISE EXCEPTION 'Usuario party_a no encontrado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_party_b) THEN
        RAISE EXCEPTION 'Usuario party_b no encontrado';
    END IF;
    
    -- Buscar hilo existente para este contexto
    SELECT id INTO existing_thread_id
    FROM chat_threads
    WHERE context_type = p_context_type 
    AND context_id = p_context_id;
    
    IF existing_thread_id IS NOT NULL THEN
        RETURN existing_thread_id;
    END IF;
    
    -- Solo crear nuevo hilo si party_a y party_b son diferentes
    IF p_party_a = p_party_b THEN
        RAISE EXCEPTION 'party_a y party_b deben ser diferentes para crear un nuevo thread';
    END IF;
    
    -- Crear nuevo hilo
    INSERT INTO chat_threads (
        context_type, context_id, party_a, party_b,
        context_title, context_data
    ) VALUES (
        p_context_type, p_context_id, p_party_a, p_party_b,
        p_context_title, p_context_data
    ) RETURNING id INTO thread_id;
    
    -- Crear estado de lectura inicial (con manejo de errores)
    BEGIN
        INSERT INTO chat_read_status (thread_id, user_id) VALUES (thread_id, p_party_a);
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    
    BEGIN
        INSERT INTO chat_read_status (thread_id, user_id) VALUES (thread_id, p_party_b);
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    
    RETURN thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que la función se creó correctamente
SELECT 'Función open_or_get_thread creada correctamente' as resultado;

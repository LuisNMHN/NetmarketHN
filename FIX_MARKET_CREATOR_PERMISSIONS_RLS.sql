-- =========================================================
-- CORRECCIÓN DE POLÍTICAS RLS PARA market_creator_permissions
-- =========================================================
-- Este script agrega las políticas necesarias para que los
-- administradores puedan gestionar permisos de creadores de mercados
-- =========================================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own permissions" ON market_creator_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON market_creator_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON market_creator_permissions;

-- Política para SELECT: Usuarios pueden ver sus propios permisos
CREATE POLICY "Users can view their own permissions"
    ON market_creator_permissions FOR SELECT
    USING (auth.uid() = user_id);

-- Política para SELECT: Administradores pueden ver todos los permisos
CREATE POLICY "Admins can view all permissions"
    ON market_creator_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- Política para INSERT, UPDATE, DELETE: Solo administradores pueden gestionar permisos
CREATE POLICY "Admins can manage permissions"
    ON market_creator_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );



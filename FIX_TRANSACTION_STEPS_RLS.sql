-- =========================================================
-- FIX: Permitir a los usuarios actualizar transaction_steps
-- =========================================================

-- Permitir a los usuarios actualizar pasos de sus transacciones
CREATE POLICY "Users can update their transaction steps" ON transaction_steps
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

-- Permitir a los usuarios insertar pasos en sus transacciones
CREATE POLICY "Users can insert their transaction steps" ON transaction_steps
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_transactions 
            WHERE id = transaction_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

SELECT 'Políticas RLS para transaction_steps creadas correctamente' as resultado;


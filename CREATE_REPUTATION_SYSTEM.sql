-- =========================================================
-- SISTEMA DE REPUTACIÓN PROFESIONAL PARA NMHN
-- =========================================================
-- Sistema completo de reputación similar a plataformas como eBay, MercadoLibre
-- Incluye calificaciones, reviews, badges, métricas avanzadas
-- =========================================================

-- =========================================================
-- 1. TABLA DE CALIFICACIONES/REVIEWS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participantes de la transacción
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Contexto de la calificación
    transaction_id UUID, -- Referencia a la transacción específica
    context_type VARCHAR(20) NOT NULL DEFAULT 'transaction' CHECK (context_type IN ('transaction', 'service', 'general')),
    
    -- Calificaciones numéricas (1-5 estrellas)
    communication_rating INTEGER NOT NULL CHECK (communication_rating >= 1 AND communication_rating <= 5),
    reliability_rating INTEGER NOT NULL CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
    quality_rating INTEGER NOT NULL CHECK (quality_rating >= 1 AND quality_rating <= 5),
    overall_rating DECIMAL(3,2) NOT NULL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
    
    -- Review textual
    review_text TEXT,
    review_title VARCHAR(200),
    
    -- Metadatos
    is_verified BOOLEAN DEFAULT FALSE, -- Si la transacción fue verificada
    is_public BOOLEAN DEFAULT TRUE, -- Si es visible públicamente
    is_anonymous BOOLEAN DEFAULT FALSE, -- Si el reviewer quiere permanecer anónimo
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_review CHECK (reviewer_id != reviewed_id),
    CONSTRAINT unique_transaction_review UNIQUE (reviewer_id, transaction_id)
);

-- =========================================================
-- 2. TABLA DE MÉTRICAS DE REPUTACIÓN
-- =========================================================

CREATE TABLE IF NOT EXISTS user_reputation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Métricas principales
    overall_score DECIMAL(5,2) DEFAULT 0.0 CHECK (overall_score >= 0.0 AND overall_score <= 100.0),
    total_reviews INTEGER DEFAULT 0 CHECK (total_reviews >= 0),
    positive_reviews INTEGER DEFAULT 0 CHECK (positive_reviews >= 0),
    neutral_reviews INTEGER DEFAULT 0 CHECK (neutral_reviews >= 0),
    negative_reviews INTEGER DEFAULT 0 CHECK (negative_reviews >= 0),
    
    -- Distribución de calificaciones
    five_star_count INTEGER DEFAULT 0 CHECK (five_star_count >= 0),
    four_star_count INTEGER DEFAULT 0 CHECK (four_star_count >= 0),
    three_star_count INTEGER DEFAULT 0 CHECK (three_star_count >= 0),
    two_star_count INTEGER DEFAULT 0 CHECK (two_star_count >= 0),
    one_star_count INTEGER DEFAULT 0 CHECK (one_star_count >= 0),
    
    -- Métricas por categoría
    avg_communication DECIMAL(3,2) DEFAULT 0.0 CHECK (avg_communication >= 0.0 AND avg_communication <= 5.0),
    avg_reliability DECIMAL(3,2) DEFAULT 0.0 CHECK (avg_reliability >= 0.0 AND avg_reliability <= 5.0),
    avg_quality DECIMAL(3,2) DEFAULT 0.0 CHECK (avg_quality >= 0.0 AND avg_quality <= 5.0),
    
    -- Métricas de actividad
    total_transactions INTEGER DEFAULT 0 CHECK (total_transactions >= 0),
    successful_transactions INTEGER DEFAULT 0 CHECK (successful_transactions >= 0),
    cancelled_transactions INTEGER DEFAULT 0 CHECK (cancelled_transactions >= 0),
    disputed_transactions INTEGER DEFAULT 0 CHECK (disputed_transactions >= 0),
    
    -- Métricas de tiempo
    member_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_avg INTEGER DEFAULT 0, -- En minutos
    
    -- Fechas de actualización
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 3. TABLA DE BADGES Y LOGROS
-- =========================================================

CREATE TABLE IF NOT EXISTS reputation_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información del badge
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(50) NOT NULL, -- Nombre del icono de Lucide
    color VARCHAR(20) NOT NULL DEFAULT 'blue',
    
    -- Criterios para obtener el badge
    criteria_type VARCHAR(50) NOT NULL, -- 'review_count', 'score_threshold', 'transaction_count', etc.
    criteria_value INTEGER NOT NULL,
    criteria_condition VARCHAR(20) DEFAULT 'gte', -- 'gte', 'lte', 'eq'
    
    -- Metadatos
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Para ordenar badges
    category VARCHAR(50) DEFAULT 'general', -- 'transaction', 'communication', 'reliability', etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 4. TABLA DE BADGES ASIGNADOS A USUARIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES reputation_badges(id) ON DELETE CASCADE,
    
    -- Metadatos
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_displayed BOOLEAN DEFAULT TRUE,
    
    -- Constraint para evitar duplicados
    CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

-- =========================================================
-- 5. TABLA DE REPORTES DE REPUTACIÓN
-- =========================================================

CREATE TABLE IF NOT EXISTS reputation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participantes
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Contexto del reporte
    review_id UUID REFERENCES user_reviews(id) ON DELETE CASCADE,
    transaction_id UUID,
    
    -- Detalles del reporte
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'fake_review', 'inappropriate_content', 'harassment', 
        'spam', 'fraud', 'other'
    )),
    report_reason TEXT NOT NULL,
    evidence_urls TEXT[], -- URLs de evidencia
    
    -- Estado del reporte
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    admin_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint
    CONSTRAINT no_self_report CHECK (reporter_id != reported_user_id)
);

-- =========================================================
-- 6. ÍNDICES PARA OPTIMIZACIÓN
-- =========================================================

-- Índices para user_reviews
CREATE INDEX IF NOT EXISTS idx_user_reviews_reviewed_id ON user_reviews(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_reviewer_id ON user_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_transaction_id ON user_reviews(transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_created_at ON user_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reviews_overall_rating ON user_reviews(overall_rating);

-- Índices para user_reputation_metrics
CREATE INDEX IF NOT EXISTS idx_reputation_metrics_user_id ON user_reputation_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_metrics_overall_score ON user_reputation_metrics(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_metrics_total_reviews ON user_reputation_metrics(total_reviews DESC);

-- Índices para user_badges
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at DESC);

-- Índices para reputation_reports
CREATE INDEX IF NOT EXISTS idx_reputation_reports_reported_user ON reputation_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_reports_reporter ON reputation_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reputation_reports_status ON reputation_reports(status);

-- =========================================================
-- 7. FUNCIONES PARA CALCULAR REPUTACIÓN
-- =========================================================

-- Función para calcular el score general de reputación
CREATE OR REPLACE FUNCTION calculate_reputation_score(p_user_id UUID)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score DECIMAL(5,2) := 0.0;
    v_total_reviews INTEGER := 0;
    v_avg_rating DECIMAL(3,2) := 0.0;
    v_positive_percentage DECIMAL(5,2) := 0.0;
    v_volume_bonus DECIMAL(5,2) := 0.0;
    v_time_bonus DECIMAL(5,2) := 0.0;
    v_consistency_bonus DECIMAL(5,2) := 0.0;
BEGIN
    -- Obtener métricas básicas
    SELECT 
        COUNT(*),
        AVG(overall_rating),
        COUNT(CASE WHEN overall_rating >= 4.0 THEN 1 END) * 100.0 / COUNT(*)
    INTO v_total_reviews, v_avg_rating, v_positive_percentage
    FROM user_reviews 
    WHERE reviewed_id = p_user_id AND is_public = TRUE;
    
    -- Si no hay reviews, retornar score base
    IF v_total_reviews = 0 THEN
        RETURN 50.0; -- Score neutral para usuarios nuevos
    END IF;
    
    -- Calcular score base (0-60 puntos)
    v_score := (v_avg_rating - 1.0) * 15.0; -- Convierte 1-5 estrellas a 0-60 puntos
    
    -- Bonus por porcentaje de reviews positivas (0-20 puntos)
    v_positive_percentage := COALESCE(v_positive_percentage, 0.0);
    v_score := v_score + (v_positive_percentage * 0.2);
    
    -- Bonus por volumen de reviews (0-10 puntos)
    IF v_total_reviews >= 50 THEN
        v_volume_bonus := 10.0;
    ELSIF v_total_reviews >= 20 THEN
        v_volume_bonus := 7.0;
    ELSIF v_total_reviews >= 10 THEN
        v_volume_bonus := 5.0;
    ELSIF v_total_reviews >= 5 THEN
        v_volume_bonus := 3.0;
    ELSE
        v_volume_bonus := 1.0;
    END IF;
    v_score := v_score + v_volume_bonus;
    
    -- Bonus por tiempo como miembro (0-5 puntos)
    SELECT EXTRACT(DAYS FROM NOW() - member_since) / 30.0 INTO v_time_bonus
    FROM user_reputation_metrics 
    WHERE user_id = p_user_id;
    
    v_time_bonus := LEAST(COALESCE(v_time_bonus, 0.0), 5.0);
    v_score := v_score + v_time_bonus;
    
    -- Bonus por consistencia (0-5 puntos)
    -- Usuarios con calificaciones consistentes obtienen bonus
    IF v_avg_rating >= 4.5 AND v_positive_percentage >= 90.0 THEN
        v_consistency_bonus := 5.0;
    ELSIF v_avg_rating >= 4.0 AND v_positive_percentage >= 80.0 THEN
        v_consistency_bonus := 3.0;
    ELSIF v_avg_rating >= 3.5 AND v_positive_percentage >= 70.0 THEN
        v_consistency_bonus := 1.0;
    END IF;
    v_score := v_score + v_consistency_bonus;
    
    -- Asegurar que el score esté entre 0 y 100
    v_score := GREATEST(0.0, LEAST(100.0, v_score));
    
    RETURN v_score;
END;
$$;

-- Función para actualizar métricas de reputación
CREATE OR REPLACE FUNCTION update_user_reputation_metrics(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_reviews INTEGER;
    v_positive_reviews INTEGER;
    v_neutral_reviews INTEGER;
    v_negative_reviews INTEGER;
    v_avg_communication DECIMAL(3,2);
    v_avg_reliability DECIMAL(3,2);
    v_avg_quality DECIMAL(3,2);
    v_overall_score DECIMAL(5,2);
BEGIN
    -- Calcular métricas de reviews
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN overall_rating >= 4.0 THEN 1 END),
        COUNT(CASE WHEN overall_rating = 3.0 THEN 1 END),
        COUNT(CASE WHEN overall_rating <= 2.0 THEN 1 END),
        AVG(communication_rating),
        AVG(reliability_rating),
        AVG(quality_rating)
    INTO 
        v_total_reviews,
        v_positive_reviews,
        v_neutral_reviews,
        v_negative_reviews,
        v_avg_communication,
        v_avg_reliability,
        v_avg_quality
    FROM user_reviews 
    WHERE reviewed_id = p_user_id AND is_public = TRUE;
    
    -- Calcular score general
    v_overall_score := calculate_reputation_score(p_user_id);
    
    -- Insertar o actualizar métricas
    INSERT INTO user_reputation_metrics (
        user_id,
        overall_score,
        total_reviews,
        positive_reviews,
        neutral_reviews,
        negative_reviews,
        avg_communication,
        avg_reliability,
        avg_quality,
        last_calculated_at,
        updated_at
    ) VALUES (
        p_user_id,
        v_overall_score,
        COALESCE(v_total_reviews, 0),
        COALESCE(v_positive_reviews, 0),
        COALESCE(v_neutral_reviews, 0),
        COALESCE(v_negative_reviews, 0),
        COALESCE(v_avg_communication, 0.0),
        COALESCE(v_avg_reliability, 0.0),
        COALESCE(v_avg_quality, 0.0),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        total_reviews = EXCLUDED.total_reviews,
        positive_reviews = EXCLUDED.positive_reviews,
        neutral_reviews = EXCLUDED.neutral_reviews,
        negative_reviews = EXCLUDED.negative_reviews,
        avg_communication = EXCLUDED.avg_communication,
        avg_reliability = EXCLUDED.avg_reliability,
        avg_quality = EXCLUDED.avg_quality,
        last_calculated_at = EXCLUDED.last_calculated_at,
        updated_at = EXCLUDED.updated_at;
END;
$$;

-- =========================================================
-- 8. TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =========================================================

-- Trigger para actualizar métricas cuando se crea una review
CREATE OR REPLACE FUNCTION trigger_update_reputation_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Actualizar métricas del usuario calificado
    PERFORM update_user_reputation_metrics(NEW.reviewed_id);
    
    -- Actualizar métricas del usuario que califica (si es necesario)
    PERFORM update_user_reputation_metrics(NEW.reviewer_id);
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_reputation_on_review_insert
    AFTER INSERT ON user_reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_reputation_on_review();

CREATE TRIGGER update_reputation_on_review_update
    AFTER UPDATE ON user_reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_reputation_on_review();

-- =========================================================
-- 9. BADGES PREDEFINIDOS
-- =========================================================

-- Insertar badges predefinidos
INSERT INTO reputation_badges (name, display_name, description, icon_name, color, criteria_type, criteria_value, category, priority) VALUES
-- Badges de volumen de reviews
('first_review', 'Primera Calificación', 'Recibió su primera calificación', 'Star', 'yellow', 'review_count', 1, 'milestone', 1),
('reviewed_5', 'Bien Calificado', 'Recibió 5 calificaciones', 'Star', 'blue', 'review_count', 5, 'milestone', 2),
('reviewed_10', 'Experto', 'Recibió 10 calificaciones', 'Star', 'green', 'review_count', 10, 'milestone', 3),
('reviewed_25', 'Profesional', 'Recibió 25 calificaciones', 'Star', 'purple', 'review_count', 25, 'milestone', 4),
('reviewed_50', 'Maestro', 'Recibió 50 calificaciones', 'Star', 'gold', 'milestone', 50, 'milestone', 5),

-- Badges de calidad
('excellent_rating', 'Calificación Excelente', 'Mantiene promedio de 4.5+ estrellas', 'Award', 'gold', 'score_threshold', 90, 'quality', 6),
('great_communication', 'Excelente Comunicación', 'Promedio de comunicación 4.5+', 'MessageCircle', 'blue', 'communication_threshold', 90, 'communication', 7),
('highly_reliable', 'Altamente Confiable', 'Promedio de confiabilidad 4.5+', 'Shield', 'green', 'reliability_threshold', 90, 'reliability', 8),

-- Badges de actividad
('active_member', 'Miembro Activo', 'Miembro por más de 6 meses', 'Calendar', 'blue', 'member_months', 6, 'activity', 9),
('veteran', 'Veterano', 'Miembro por más de 2 años', 'Crown', 'purple', 'member_months', 24, 'activity', 10),

-- Badges especiales
('perfect_score', 'Puntuación Perfecta', 'Mantiene 100% de calificaciones positivas', 'Trophy', 'gold', 'perfect_score', 100, 'special', 11),
('community_favorite', 'Favorito de la Comunidad', 'Más de 20 calificaciones de 5 estrellas', 'Heart', 'red', 'five_star_count', 20, 'special', 12);

-- =========================================================
-- 10. POLÍTICAS RLS
-- =========================================================

-- Habilitar RLS
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_reports ENABLE ROW LEVEL SECURITY;

-- Políticas para user_reviews
CREATE POLICY "Users can view public reviews" ON user_reviews
    FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can view their own reviews" ON user_reviews
    FOR SELECT USING (reviewer_id = auth.uid() OR reviewed_id = auth.uid());

CREATE POLICY "Users can create reviews" ON user_reviews
    FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Users can update their own reviews" ON user_reviews
    FOR UPDATE USING (reviewer_id = auth.uid());

-- Políticas para user_reputation_metrics
CREATE POLICY "Users can view reputation metrics" ON user_reputation_metrics
    FOR SELECT USING (TRUE);

CREATE POLICY "System can update reputation metrics" ON user_reputation_metrics
    FOR ALL USING (FALSE); -- Solo funciones del sistema pueden actualizar

-- Políticas para user_badges
CREATE POLICY "Users can view badges" ON user_badges
    FOR SELECT USING (TRUE);

CREATE POLICY "System can manage badges" ON user_badges
    FOR ALL USING (FALSE); -- Solo funciones del sistema pueden gestionar

-- Políticas para reputation_reports
CREATE POLICY "Users can create reports" ON reputation_reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view their own reports" ON reputation_reports
    FOR SELECT USING (reporter_id = auth.uid());

-- =========================================================
-- 11. COMENTARIOS Y DOCUMENTACIÓN
-- =========================================================

COMMENT ON TABLE user_reviews IS 'Sistema de calificaciones y reviews entre usuarios';
COMMENT ON TABLE user_reputation_metrics IS 'Métricas calculadas de reputación por usuario';
COMMENT ON TABLE reputation_badges IS 'Badges y logros disponibles en el sistema';
COMMENT ON TABLE user_badges IS 'Badges asignados a usuarios específicos';
COMMENT ON TABLE reputation_reports IS 'Reportes de problemas con reputación';

COMMENT ON FUNCTION calculate_reputation_score IS 'Calcula el score de reputación (0-100) basado en múltiples factores';
COMMENT ON FUNCTION update_user_reputation_metrics IS 'Actualiza todas las métricas de reputación de un usuario';

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. El sistema calcula reputación basado en múltiples factores
-- 2. Los scores van de 0 a 100 puntos
-- 3. Se incluyen bonuses por volumen, tiempo y consistencia
-- 4. Los badges se asignan automáticamente según criterios
-- 5. Sistema de reportes para mantener integridad
-- 6. RLS habilitado para seguridad
-- =========================================================

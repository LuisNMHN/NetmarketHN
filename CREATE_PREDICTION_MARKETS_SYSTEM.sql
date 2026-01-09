-- =========================================================
-- SISTEMA DE MERCADOS DE PREDICCIÓN P2P (ESTILO POLYMARKET)
-- =========================================================
-- Este sistema permite a usuarios autorizados crear mercados
-- de predicción donde otros usuarios pueden comprar/vender
-- acciones sobre eventos futuros usando HNLD
-- =========================================================

-- =========================================================
-- TABLA 1: PREDICTION_MARKETS
-- =========================================================
-- Almacena los mercados de predicción creados por usuarios
CREATE TABLE IF NOT EXISTS prediction_markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    question TEXT NOT NULL, -- La pregunta del mercado (ej: "¿Ganará el equipo A?")
    
    -- Configuración del mercado
    market_type VARCHAR(50) DEFAULT 'binary', -- 'binary' (Sí/No) o 'multiple' (múltiples opciones)
    resolution_source TEXT, -- Fuente para resolver el mercado (URL, descripción, etc.)
    resolution_date TIMESTAMPTZ, -- Fecha estimada de resolución
    
    -- Estado del mercado
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed', 'resolved', 'cancelled'
    liquidity_pool_hnld NUMERIC(15, 2) DEFAULT 0, -- Pool de liquidez total
    
    -- Fechas
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Configuración de trading
    min_trade_amount NUMERIC(15, 2) DEFAULT 1.00, -- Mínimo HNLD para operar
    max_trade_amount NUMERIC(15, 2), -- Máximo HNLD por operación (NULL = sin límite)
    trading_fee_percent NUMERIC(5, 2) DEFAULT 2.00, -- Comisión del creador (%)
    platform_fee_percent NUMERIC(5, 2) DEFAULT 1.00, -- Comisión de la plataforma (%)
    
    -- Resolución
    winning_outcome_id UUID, -- ID de la opción ganadora (para mercados resueltos)
    resolution_notes TEXT, -- Notas sobre cómo se resolvió
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'closed', 'resolved', 'cancelled')),
    CONSTRAINT valid_market_type CHECK (market_type IN ('binary', 'multiple'))
);

-- Índices para prediction_markets
CREATE INDEX IF NOT EXISTS idx_prediction_markets_creator ON prediction_markets(creator_id);
CREATE INDEX IF NOT EXISTS idx_prediction_markets_status ON prediction_markets(status);
CREATE INDEX IF NOT EXISTS idx_prediction_markets_category ON prediction_markets(category);
CREATE INDEX IF NOT EXISTS idx_prediction_markets_created ON prediction_markets(created_at DESC);

-- =========================================================
-- TABLA 2: MARKET_OUTCOMES
-- =========================================================
-- Opciones/resultados posibles para cada mercado
CREATE TABLE IF NOT EXISTS market_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Nombre de la opción (ej: "Sí", "No", "Empate")
    description TEXT,
    order_index INTEGER DEFAULT 0, -- Orden de visualización
    
    -- Precios y volumen
    current_price NUMERIC(5, 4) DEFAULT 0.5000, -- Precio actual (0.0000 a 1.0000)
    total_shares NUMERIC(15, 2) DEFAULT 0, -- Total de acciones emitidas
    total_volume_hnld NUMERIC(15, 2) DEFAULT 0, -- Volumen total negociado
    
    -- Resolución
    is_winner BOOLEAN DEFAULT FALSE, -- Si esta opción ganó
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_price CHECK (current_price >= 0 AND current_price <= 1),
    CONSTRAINT unique_market_outcome_name UNIQUE(market_id, name)
);

-- Índices para market_outcomes
CREATE INDEX IF NOT EXISTS idx_market_outcomes_market ON market_outcomes(market_id);
CREATE INDEX IF NOT EXISTS idx_market_outcomes_winner ON market_outcomes(is_winner) WHERE is_winner = TRUE;

-- =========================================================
-- TABLA 3: MARKET_POSITIONS
-- =========================================================
-- Posiciones de los usuarios en cada mercado
CREATE TABLE IF NOT EXISTS market_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES market_outcomes(id) ON DELETE CASCADE,
    
    -- Posición
    shares NUMERIC(15, 2) DEFAULT 0, -- Cantidad de acciones
    average_cost_hnld NUMERIC(15, 2) DEFAULT 0, -- Costo promedio por acción
    total_invested_hnld NUMERIC(15, 2) DEFAULT 0, -- Total invertido
    
    -- Valores actuales
    current_value_hnld NUMERIC(15, 2) DEFAULT 0, -- Valor actual de la posición
    unrealized_pnl_hnld NUMERIC(15, 2) DEFAULT 0, -- Ganancia/pérdida no realizada
    
    -- Última actualización
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_market_outcome UNIQUE(user_id, market_id, outcome_id)
);

-- Índices para market_positions
CREATE INDEX IF NOT EXISTS idx_market_positions_user ON market_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_market_positions_market ON market_positions(market_id);
CREATE INDEX IF NOT EXISTS idx_market_positions_outcome ON market_positions(outcome_id);

-- =========================================================
-- TABLA 4: MARKET_TRADES
-- =========================================================
-- Historial de todas las operaciones de trading
CREATE TABLE IF NOT EXISTS market_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES market_outcomes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Detalles de la operación
    trade_type VARCHAR(20) NOT NULL, -- 'buy' o 'sell'
    shares NUMERIC(15, 2) NOT NULL, -- Cantidad de acciones
    price_per_share NUMERIC(5, 4) NOT NULL, -- Precio por acción al momento de la operación
    total_cost_hnld NUMERIC(15, 2) NOT NULL, -- Costo total (incluye fees)
    
    -- Fees
    creator_fee_hnld NUMERIC(15, 2) DEFAULT 0, -- Comisión al creador
    platform_fee_hnld NUMERIC(15, 2) DEFAULT 0, -- Comisión a la plataforma
    
    -- Balance después de la operación
    shares_after NUMERIC(15, 2) NOT NULL, -- Acciones que tiene el usuario después
    balance_after_hnld NUMERIC(15, 2) NOT NULL, -- Balance HNLD después
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_trade_type CHECK (trade_type IN ('buy', 'sell')),
    CONSTRAINT valid_shares CHECK (shares > 0),
    CONSTRAINT valid_price CHECK (price_per_share >= 0 AND price_per_share <= 1)
);

-- Índices para market_trades
CREATE INDEX IF NOT EXISTS idx_market_trades_user ON market_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_market_trades_market ON market_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_market_trades_outcome ON market_trades(outcome_id);
CREATE INDEX IF NOT EXISTS idx_market_trades_created ON market_trades(created_at DESC);

-- =========================================================
-- TABLA 5: MARKET_CREATOR_PERMISSIONS
-- =========================================================
-- Permisos para usuarios que pueden crear mercados
CREATE TABLE IF NOT EXISTS market_creator_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de permiso
    permission_type VARCHAR(50) DEFAULT 'paid', -- 'paid', 'verified', 'admin'
    
    -- Límites
    max_active_markets INTEGER DEFAULT 10, -- Máximo de mercados activos simultáneos
    max_daily_markets INTEGER DEFAULT 5, -- Máximo de mercados por día
    
    -- Estadísticas
    total_markets_created INTEGER DEFAULT 0,
    total_volume_hnld NUMERIC(15, 2) DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ, -- NULL = permanente
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_permission UNIQUE(user_id),
    CONSTRAINT valid_permission_type CHECK (permission_type IN ('paid', 'verified', 'admin'))
);

-- Índices para market_creator_permissions
CREATE INDEX IF NOT EXISTS idx_market_creator_permissions_user ON market_creator_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_market_creator_permissions_active ON market_creator_permissions(is_active) WHERE is_active = TRUE;

-- =========================================================
-- FUNCIÓN: Verificar si usuario puede crear mercados
-- =========================================================
CREATE OR REPLACE FUNCTION can_create_market(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_permission RECORD;
    v_active_markets INTEGER;
    v_today_markets INTEGER;
BEGIN
    -- Verificar si tiene permiso
    SELECT * INTO v_permission
    FROM market_creator_permissions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());
    
    IF v_permission IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar límite de mercados activos
    SELECT COUNT(*) INTO v_active_markets
    FROM prediction_markets
    WHERE creator_id = p_user_id
      AND status = 'active';
    
    IF v_active_markets >= v_permission.max_active_markets THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar límite diario
    SELECT COUNT(*) INTO v_today_markets
    FROM prediction_markets
    WHERE creator_id = p_user_id
      AND created_at::date = CURRENT_DATE;
    
    IF v_today_markets >= v_permission.max_daily_markets THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Crear mercado de predicción
-- =========================================================
CREATE OR REPLACE FUNCTION create_prediction_market(
    p_creator_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_question TEXT,
    p_category VARCHAR(100),
    p_market_type VARCHAR(50) DEFAULT 'binary',
    p_resolution_source TEXT DEFAULT NULL,
    p_resolution_date TIMESTAMPTZ DEFAULT NULL,
    p_outcomes JSONB DEFAULT NULL -- [{"name": "Sí", "description": ""}, {"name": "No", "description": ""}]
)
RETURNS UUID AS $$
DECLARE
    v_market_id UUID;
    v_outcome JSONB;
BEGIN
    -- Verificar permisos
    IF NOT can_create_market(p_creator_id) THEN
        RAISE EXCEPTION 'Usuario no tiene permisos para crear mercados o ha excedido los límites';
    END IF;
    
    -- Crear el mercado
    INSERT INTO prediction_markets (
        creator_id, title, description, question, category,
        market_type, resolution_source, resolution_date
    ) VALUES (
        p_creator_id, p_title, p_description, p_question, p_category,
        p_market_type, p_resolution_source, p_resolution_date
    ) RETURNING id INTO v_market_id;
    
    -- Crear outcomes por defecto para mercados binarios
    IF p_market_type = 'binary' AND p_outcomes IS NULL THEN
        INSERT INTO market_outcomes (market_id, name, description, order_index, current_price)
        VALUES
            (v_market_id, 'Sí', 'Opción afirmativa', 0, 0.5000),
            (v_market_id, 'No', 'Opción negativa', 1, 0.5000);
    ELSIF p_outcomes IS NOT NULL THEN
        -- Crear outcomes personalizados
        FOR v_outcome IN SELECT * FROM jsonb_array_elements(p_outcomes)
        LOOP
            INSERT INTO market_outcomes (market_id, name, description, order_index, current_price)
            VALUES (
                v_market_id,
                v_outcome->>'name',
                v_outcome->>'description',
                COALESCE((v_outcome->>'order_index')::INTEGER, 0),
                1.0 / (SELECT COUNT(*) FROM jsonb_array_elements(p_outcomes)) -- Precio inicial igual para todas
            );
        END LOOP;
    END IF;
    
    -- Actualizar estadísticas del creador
    UPDATE market_creator_permissions
    SET total_markets_created = total_markets_created + 1,
        updated_at = NOW()
    WHERE user_id = p_creator_id;
    
    RETURN v_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Comprar acciones en un mercado
-- =========================================================
CREATE OR REPLACE FUNCTION buy_market_shares(
    p_user_id UUID,
    p_market_id UUID,
    p_outcome_id UUID,
    p_shares NUMERIC,
    p_max_price NUMERIC DEFAULT NULL -- Precio máximo aceptable (opcional)
)
RETURNS UUID AS $$
DECLARE
    v_trade_id UUID;
    v_market RECORD;
    v_outcome RECORD;
    v_price NUMERIC;
    v_total_cost NUMERIC;
    v_creator_fee NUMERIC;
    v_platform_fee NUMERIC;
    v_net_cost NUMERIC;
    v_user_balance NUMERIC;
    v_position RECORD;
BEGIN
    -- Obtener información del mercado y outcome
    SELECT * INTO v_market FROM prediction_markets WHERE id = p_market_id;
    SELECT * INTO v_outcome FROM market_outcomes WHERE id = p_outcome_id AND market_id = p_market_id;
    
    IF v_market IS NULL OR v_outcome IS NULL THEN
        RAISE EXCEPTION 'Mercado o opción no encontrada';
    END IF;
    
    IF v_market.status != 'active' THEN
        RAISE EXCEPTION 'El mercado no está activo';
    END IF;
    
    -- Obtener precio actual (usando mecanismo de mercado de predicción)
    -- Por simplicidad, usamos el precio actual del outcome
    -- En un sistema real, esto podría usar un mecanismo AMM (Automated Market Maker)
    v_price := v_outcome.current_price;
    
    -- Verificar precio máximo si se especificó
    IF p_max_price IS NOT NULL AND v_price > p_max_price THEN
        RAISE EXCEPTION 'El precio actual (%.4f) excede el precio máximo (%.4f)', v_price, p_max_price;
    END IF;
    
    -- Calcular costos
    v_total_cost := p_shares * v_price;
    v_creator_fee := v_total_cost * (v_market.trading_fee_percent / 100);
    v_platform_fee := v_total_cost * (v_market.platform_fee_percent / 100);
    v_net_cost := v_total_cost + v_creator_fee + v_platform_fee;
    
    -- Verificar balance del usuario
    SELECT available_balance INTO v_user_balance
    FROM user_balances
    WHERE user_id = p_user_id;
    
    IF v_user_balance IS NULL OR v_user_balance < v_net_cost THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: %.2f HNLD, Requerido: %.2f HNLD', 
            COALESCE(v_user_balance, 0), v_net_cost;
    END IF;
    
    -- Verificar monto mínimo
    IF v_net_cost < v_market.min_trade_amount THEN
        RAISE EXCEPTION 'El monto mínimo es %.2f HNLD', v_market.min_trade_amount;
    END IF;
    
    -- Verificar monto máximo si existe
    IF v_market.max_trade_amount IS NOT NULL AND v_net_cost > v_market.max_trade_amount THEN
        RAISE EXCEPTION 'El monto máximo por operación es %.2f HNLD', v_market.max_trade_amount;
    END IF;
    
    -- Descontar balance
    UPDATE user_balances
    SET available_balance = available_balance - v_net_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Registrar transacción de balance
    INSERT INTO balance_transactions (
        user_id, transaction_type, amount, balance_after, description
    ) VALUES (
        p_user_id, 'market_trade', -v_net_cost, v_user_balance - v_net_cost,
        format('Compra de %.2f acciones en mercado "%s"', p_shares, v_market.title)
    );
    
    -- Actualizar o crear posición
    SELECT * INTO v_position
    FROM market_positions
    WHERE user_id = p_user_id AND market_id = p_market_id AND outcome_id = p_outcome_id;
    
    IF v_position IS NULL THEN
        -- Crear nueva posición
        INSERT INTO market_positions (
            user_id, market_id, outcome_id, shares, average_cost_hnld, total_invested_hnld,
            current_value_hnld, unrealized_pnl_hnld
        ) VALUES (
            p_user_id, p_market_id, p_outcome_id, p_shares, v_price, v_total_cost,
            p_shares * v_price, 0
        );
    ELSE
        -- Actualizar posición existente
        UPDATE market_positions
        SET 
            shares = shares + p_shares,
            average_cost_hnld = ((average_cost_hnld * shares) + (v_price * p_shares)) / (shares + p_shares),
            total_invested_hnld = total_invested_hnld + v_total_cost,
            current_value_hnld = (shares + p_shares) * v_price,
            unrealized_pnl_hnld = ((shares + p_shares) * v_price) - (total_invested_hnld + v_total_cost),
            updated_at = NOW()
        WHERE id = v_position.id;
    END IF;
    
    -- Actualizar outcome (aumentar precio ligeramente por compra)
    -- Mecanismo simple: aumentar precio en 0.01% por cada compra
    UPDATE market_outcomes
    SET 
        current_price = LEAST(0.9999, current_price + (current_price * 0.0001)),
        total_shares = total_shares + p_shares,
        total_volume_hnld = total_volume_hnld + v_total_cost
    WHERE id = p_outcome_id;
    
    -- Actualizar pool de liquidez del mercado
    UPDATE prediction_markets
    SET liquidity_pool_hnld = liquidity_pool_hnld + v_total_cost
    WHERE id = p_market_id;
    
    -- Pagar fees al creador
    IF v_creator_fee > 0 THEN
        UPDATE user_balances
        SET available_balance = available_balance + v_creator_fee,
            updated_at = NOW()
        WHERE user_id = v_market.creator_id;
        
        INSERT INTO balance_transactions (
            user_id, transaction_type, amount, balance_after, description
        ) VALUES (
            v_market.creator_id, 'market_fee', v_creator_fee,
            (SELECT available_balance FROM user_balances WHERE user_id = v_market.creator_id),
            format('Comisión de mercado "%s"', v_market.title)
        );
    END IF;
    
    -- Registrar trade
    INSERT INTO market_trades (
        market_id, outcome_id, user_id, trade_type, shares, price_per_share,
        total_cost_hnld, creator_fee_hnld, platform_fee_hnld,
        shares_after, balance_after_hnld
    ) VALUES (
        p_market_id, p_outcome_id, p_user_id, 'buy', p_shares, v_price,
        v_total_cost, v_creator_fee, v_platform_fee,
        COALESCE(v_position.shares, 0) + p_shares,
        v_user_balance - v_net_cost
    ) RETURNING id INTO v_trade_id;
    
    RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Vender acciones en un mercado
-- =========================================================
CREATE OR REPLACE FUNCTION sell_market_shares(
    p_user_id UUID,
    p_market_id UUID,
    p_outcome_id UUID,
    p_shares NUMERIC,
    p_min_price NUMERIC DEFAULT NULL -- Precio mínimo aceptable (opcional)
)
RETURNS UUID AS $$
DECLARE
    v_trade_id UUID;
    v_market RECORD;
    v_outcome RECORD;
    v_price NUMERIC;
    v_total_revenue NUMERIC;
    v_creator_fee NUMERIC;
    v_platform_fee NUMERIC;
    v_net_revenue NUMERIC;
    v_position RECORD;
    v_user_balance NUMERIC;
BEGIN
    -- Obtener información del mercado y outcome
    SELECT * INTO v_market FROM prediction_markets WHERE id = p_market_id;
    SELECT * INTO v_outcome FROM market_outcomes WHERE id = p_outcome_id AND market_id = p_market_id;
    
    IF v_market IS NULL OR v_outcome IS NULL THEN
        RAISE EXCEPTION 'Mercado o opción no encontrada';
    END IF;
    
    IF v_market.status != 'active' THEN
        RAISE EXCEPTION 'El mercado no está activo';
    END IF;
    
    -- Verificar que el usuario tiene suficientes acciones
    SELECT * INTO v_position
    FROM market_positions
    WHERE user_id = p_user_id AND market_id = p_market_id AND outcome_id = p_outcome_id;
    
    IF v_position IS NULL OR v_position.shares < p_shares THEN
        RAISE EXCEPTION 'No tienes suficientes acciones. Disponibles: %.2f, Solicitadas: %.2f',
            COALESCE(v_position.shares, 0), p_shares;
    END IF;
    
    -- Obtener precio actual
    v_price := v_outcome.current_price;
    
    -- Verificar precio mínimo si se especificó
    IF p_min_price IS NOT NULL AND v_price < p_min_price THEN
        RAISE EXCEPTION 'El precio actual (%.4f) es menor al precio mínimo (%.4f)', v_price, p_min_price;
    END IF;
    
    -- Calcular ingresos
    v_total_revenue := p_shares * v_price;
    v_creator_fee := v_total_revenue * (v_market.trading_fee_percent / 100);
    v_platform_fee := v_total_revenue * (v_market.platform_fee_percent / 100);
    v_net_revenue := v_total_revenue - v_creator_fee - v_platform_fee;
    
    -- Obtener balance actual
    SELECT available_balance INTO v_user_balance
    FROM user_balances
    WHERE user_id = p_user_id;
    
    -- Acreditar balance
    UPDATE user_balances
    SET available_balance = available_balance + v_net_revenue,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Registrar transacción de balance
    INSERT INTO balance_transactions (
        user_id, transaction_type, amount, balance_after, description
    ) VALUES (
        p_user_id, 'market_trade', v_net_revenue, v_user_balance + v_net_revenue,
        format('Venta de %.2f acciones en mercado "%s"', p_shares, v_market.title)
    );
    
    -- Actualizar posición
    UPDATE market_positions
    SET 
        shares = shares - p_shares,
        total_invested_hnld = GREATEST(0, total_invested_hnld - (average_cost_hnld * p_shares)),
        current_value_hnld = (shares - p_shares) * v_price,
        unrealized_pnl_hnld = ((shares - p_shares) * v_price) - GREATEST(0, total_invested_hnld - (average_cost_hnld * p_shares)),
        updated_at = NOW()
    WHERE id = v_position.id;
    
    -- Eliminar posición si quedó en 0
    DELETE FROM market_positions
    WHERE shares <= 0;
    
    -- Actualizar outcome (disminuir precio ligeramente por venta)
    UPDATE market_outcomes
    SET 
        current_price = GREATEST(0.0001, current_price - (current_price * 0.0001)),
        total_shares = GREATEST(0, total_shares - p_shares),
        total_volume_hnld = total_volume_hnld + v_total_revenue
    WHERE id = p_outcome_id;
    
    -- Pagar fees al creador
    IF v_creator_fee > 0 THEN
        UPDATE user_balances
        SET available_balance = available_balance + v_creator_fee,
            updated_at = NOW()
        WHERE user_id = v_market.creator_id;
        
        INSERT INTO balance_transactions (
            user_id, transaction_type, amount, balance_after, description
        ) VALUES (
            v_market.creator_id, 'market_fee', v_creator_fee,
            (SELECT available_balance FROM user_balances WHERE user_id = v_market.creator_id),
            format('Comisión de mercado "%s"', v_market.title)
        );
    END IF;
    
    -- Registrar trade
    INSERT INTO market_trades (
        market_id, outcome_id, user_id, trade_type, shares, price_per_share,
        total_cost_hnld, creator_fee_hnld, platform_fee_hnld,
        shares_after, balance_after_hnld
    ) VALUES (
        p_market_id, p_outcome_id, p_user_id, 'sell', p_shares, v_price,
        v_total_revenue, v_creator_fee, v_platform_fee,
        v_position.shares - p_shares,
        v_user_balance + v_net_revenue
    ) RETURNING id INTO v_trade_id;
    
    RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Resolver mercado
-- =========================================================
CREATE OR REPLACE FUNCTION resolve_prediction_market(
    p_market_id UUID,
    p_winning_outcome_id UUID,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_market RECORD;
    v_winning_outcome RECORD;
    v_position RECORD;
    v_payout NUMERIC;
    v_user_balance NUMERIC;
BEGIN
    -- Obtener mercado
    SELECT * INTO v_market FROM prediction_markets WHERE id = p_market_id;
    
    IF v_market IS NULL THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;
    
    IF v_market.status != 'active' AND v_market.status != 'closed' THEN
        RAISE EXCEPTION 'El mercado ya fue resuelto o cancelado';
    END IF;
    
    -- Verificar que el outcome pertenece al mercado
    SELECT * INTO v_winning_outcome
    FROM market_outcomes
    WHERE id = p_winning_outcome_id AND market_id = p_market_id;
    
    IF v_winning_outcome IS NULL THEN
        RAISE EXCEPTION 'La opción ganadora no pertenece a este mercado';
    END IF;
    
    -- Marcar outcome como ganador
    UPDATE market_outcomes
    SET is_winner = TRUE
    WHERE id = p_winning_outcome_id;
    
    -- Resolver mercado
    UPDATE prediction_markets
    SET 
        status = 'resolved',
        winning_outcome_id = p_winning_outcome_id,
        resolution_notes = p_resolution_notes,
        resolved_at = NOW()
    WHERE id = p_market_id;
    
    -- Liquidar posiciones ganadoras (1 HNLD por acción)
    FOR v_position IN 
        SELECT * FROM market_positions
        WHERE market_id = p_market_id AND outcome_id = p_winning_outcome_id
    LOOP
        v_payout := v_position.shares * 1.0; -- Cada acción ganadora vale 1 HNLD
        
        -- Acreditar balance
        SELECT available_balance INTO v_user_balance
        FROM user_balances
        WHERE user_id = v_position.user_id;
        
        UPDATE user_balances
        SET available_balance = available_balance + v_payout,
            updated_at = NOW()
        WHERE user_id = v_position.user_id;
        
        -- Registrar transacción
        INSERT INTO balance_transactions (
            user_id, transaction_type, amount, balance_after, description
        ) VALUES (
            v_position.user_id, 'market_resolution', v_payout,
            v_user_balance + v_payout,
            format('Resolución de mercado "%s" - %.2f acciones ganadoras', v_market.title, v_position.shares)
        );
        
        -- Actualizar posición como realizada
        UPDATE market_positions
        SET 
            current_value_hnld = v_payout,
            unrealized_pnl_hnld = v_payout - total_invested_hnld,
            updated_at = NOW()
        WHERE id = v_position.id;
    END LOOP;
    
    -- Las posiciones perdedoras ya no tienen valor (se mantienen para historial)
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================

-- Habilitar RLS
ALTER TABLE prediction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_creator_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para prediction_markets
CREATE POLICY "Anyone can view active markets"
    ON prediction_markets FOR SELECT
    USING (status IN ('active', 'closed', 'resolved'));

CREATE POLICY "Users can view their own markets"
    ON prediction_markets FOR SELECT
    USING (auth.uid() = creator_id);

CREATE POLICY "Users with permission can create markets"
    ON prediction_markets FOR INSERT
    WITH CHECK (can_create_market(auth.uid()));

CREATE POLICY "Creators can update their own markets"
    ON prediction_markets FOR UPDATE
    USING (auth.uid() = creator_id);

-- Políticas para market_outcomes
CREATE POLICY "Anyone can view outcomes"
    ON market_outcomes FOR SELECT
    USING (TRUE);

-- Políticas para market_positions
CREATE POLICY "Users can view their own positions"
    ON market_positions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own positions"
    ON market_positions FOR ALL
    USING (auth.uid() = user_id);

-- Políticas para market_trades
CREATE POLICY "Users can view their own trades"
    ON market_trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view trades of active markets"
    ON market_trades FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prediction_markets
            WHERE id = market_trades.market_id
            AND status IN ('active', 'closed', 'resolved')
        )
    );

-- Políticas para market_creator_permissions
CREATE POLICY "Users can view their own permissions"
    ON market_creator_permissions FOR SELECT
    USING (auth.uid() = user_id);

-- =========================================================
-- COMENTARIOS
-- =========================================================
COMMENT ON TABLE prediction_markets IS 'Mercados de predicción creados por usuarios autorizados';
COMMENT ON TABLE market_outcomes IS 'Opciones/resultados posibles para cada mercado';
COMMENT ON TABLE market_positions IS 'Posiciones de usuarios en mercados de predicción';
COMMENT ON TABLE market_trades IS 'Historial de operaciones de trading en mercados';
COMMENT ON TABLE market_creator_permissions IS 'Permisos para usuarios que pueden crear mercados';


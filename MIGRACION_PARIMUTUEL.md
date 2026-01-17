# Migración a Sistema Parimutuel

## Resumen

Se ha realizado una migración completa del módulo de predicciones de un sistema de compra/venta de acciones (estilo Polymarket) a un sistema **Parimutuel** basado en matemática simple.

## Cambios Principales

### 1. Base de Datos (SQL)

**Archivo:** `CREATE_PARIMUTUEL_PREDICTION_SYSTEM.sql`

#### Nuevas Tablas:
- **`market_bets`**: Reemplaza `market_positions`. Almacena apuestas Parimutuel con:
  - `bet_amount`: Cantidad apostada en HNLD
  - `probability_at_bet`: Probabilidad al momento de la apuesta
  - `potential_payout`: Ganancia potencial calculada
  - `payout_received`: Ganancia recibida al resolver

- **`market_bets_history`**: Historial de todas las apuestas realizadas

#### Modificaciones a Tablas Existentes:
- **`prediction_markets`**: 
  - Agregado `total_pool_hnld`: Pool total Parimutuel
  - `platform_fee_percent`: Comisión de plataforma (default 5%)

- **`market_outcomes`**:
  - Agregado `total_bet_amount`: Total apostado en esta opción
  - Agregado `probability`: Probabilidad calculada dinámicamente (0-1)
  - Mantiene `current_price` para compatibilidad

#### Nuevas Funciones SQL:

1. **`calculate_parimutuel_probabilities(p_market_id)`**
   - Calcula probabilidades dinámicamente basadas en el pool total
   - Fórmula: `probabilidad = (monto apostado en opción) / (pool total)`

2. **`place_parimutuel_bet(p_user_id, p_market_id, p_outcome_id, p_bet_amount)`**
   - Realiza una apuesta Parimutuel
   - Actualiza probabilidades automáticamente
   - Calcula ganancia potencial
   - Deducir comisión de plataforma

3. **`resolve_parimutuel_market(p_market_id, p_winning_outcome_id, p_resolution_notes)`**
   - Resuelve el mercado y distribuye ganancias proporcionalmente
   - Fórmula de pago: `(apuesta del usuario / total apostado en ganador) * (pool total - fees)`

### 2. Backend (TypeScript)

**Archivo:** `lib/actions/prediction_markets.ts`

#### Nuevos Tipos:
- `MarketBet`: Representa una apuesta Parimutuel
- `MarketPosition`: Actualizado para incluir `bet_amount` y `potential_payout`
- `MarketOutcome`: Agregado `probability` y `total_bet_amount`

#### Nuevas Funciones:
- `placeParimutuelBet()`: Realiza una apuesta Parimutuel
- Funciones antiguas (`buyMarketShares`, `sellMarketShares`) marcadas como `@deprecated` pero mantenidas para compatibilidad

#### Funciones Modificadas:
- `getUserPositions()`: Ahora obtiene apuestas desde `market_bets`
- `getMarketById()`: Recalcula probabilidades antes de devolver datos
- `resolveMarket()`: Usa `resolve_parimutuel_market` en lugar de `resolve_prediction_market`

### 3. Frontend

#### Página de Detalle del Mercado
**Archivo:** `app/(dashboard)/dashboard/predicciones/[id]/page.tsx`

**Cambios:**
- Reemplazado diálogo de compra/venta por diálogo de apuesta
- Muestra **probabilidades** en lugar de precios
- Muestra **total apostado** en lugar de volumen de acciones
- Botón "Apostar" en lugar de "Comprar/Vender"
- Muestra "Pool Total Parimutuel" en lugar de "Pool de Liquidez"
- Eliminada opción de vender (en Parimutuel no se pueden vender apuestas)

#### Página de Posiciones
**Archivo:** `app/(dashboard)/dashboard/predicciones/mis-posiciones/page.tsx`

**Cambios:**
- Título cambiado a "Mis Apuestas"
- Columnas actualizadas:
  - "Apuesta" en lugar de "Acciones"
  - "Probabilidad" agregada
  - "Ganancia Potencial" en lugar de "Valor Actual"
  - "Ganancia Recibida" para apuestas resueltas
- Muestra resultado final (ganador/perdedor) con ganancias/pérdidas

#### Server Actions
**Archivo:** `app/actions/prediction_markets.ts`

**Cambios:**
- Nueva función `placeBet()` que usa `placeParimutuelBet()`
- Funciones antiguas mantenidas para compatibilidad pero redirigen a nuevas

## Cómo Funciona el Sistema Parimutuel

### 1. Realizar una Apuesta

1. Usuario selecciona una opción y cantidad a apostar
2. Sistema calcula probabilidad actual: `probabilidad = (total apostado en opción) / (pool total)`
3. Se deduce comisión de plataforma (5% por defecto)
4. Se actualiza el pool total y las probabilidades de todas las opciones
5. Se calcula ganancia potencial (estimada)

### 2. Cálculo de Probabilidades

Las probabilidades se calculan dinámicamente:
```
probabilidad_opcion = (total_apostado_opcion) / (pool_total)
```

Si no hay apuestas, todas las opciones tienen probabilidad igual (1/número_de_opciones).

### 3. Resolución del Mercado

1. Creador selecciona opción ganadora
2. Sistema calcula pool de pago: `pool_pago = pool_total - (pool_total * fee_plataforma)`
3. Para cada apuesta ganadora:
   ```
   pago_usuario = (apuesta_usuario / total_apostado_ganador) * pool_pago
   ```
4. Se distribuyen ganancias proporcionalmente entre todos los ganadores
5. Las apuestas perdedoras no reciben nada

### 4. Ventajas del Sistema Parimutuel

- **Matemática simple**: Fácil de entender y calcular
- **Transparencia**: Probabilidades basadas en apuestas reales
- **Sin intermediarios**: No hay necesidad de creadores de mercado
- **Distribución justa**: Ganancias proporcionales a las apuestas

## Instalación

1. Ejecutar el script SQL:
   ```sql
   \i CREATE_PARIMUTUEL_PREDICTION_SYSTEM.sql
   ```

2. Los cambios en el código ya están aplicados y listos para usar.

## Compatibilidad

- Las funciones antiguas (`buyMarketShares`, `sellMarketShares`) están marcadas como `@deprecated` pero siguen funcionando
- Los tipos antiguos se mantienen para evitar errores de compilación
- La migración es gradual y no rompe funcionalidad existente

## Notas Importantes

1. **No se pueden vender apuestas**: En Parimutuel, las apuestas se mantienen hasta la resolución del mercado
2. **Probabilidades dinámicas**: Cambian con cada apuesta realizada
3. **Ganancias variables**: Dependen del pool total y cuántos ganadores hay
4. **Comisión única**: Solo se cobra comisión de plataforma (no hay comisión del creador en apuestas)

## Próximos Pasos (Opcional)

- Agregar visualización de historial de probabilidades
- Mostrar gráficos de evolución del pool
- Agregar estadísticas de apuestas por usuario
- Implementar sistema de cancelación de apuestas (si se requiere)

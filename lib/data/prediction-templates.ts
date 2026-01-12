// =========================================================
// PLANTILLAS PARA CREACIÓN DE PREDICCIONES
// =========================================================
// Este archivo contiene categorías, títulos y preguntas
// prefabricadas para facilitar la creación de mercados

export interface CategoryTemplate {
  id: string
  name: string
  icon: string
  description: string
  titles: string[]
  questions: Record<string, string[]> // Preguntas por título
}

export const PREDICTION_CATEGORIES: CategoryTemplate[] = [
  {
    id: "deportes",
    name: "Deportes",
    icon: "⚽",
    description: "Fútbol, básquetbol, tenis y otros deportes",
    titles: [
      "¿Ganará el equipo local en el próximo partido?",
      "¿El equipo visitante marcará más de 2 goles?",
      "¿Habrá más de 3 goles en el partido?",
      "¿El partido terminará en empate?",
      "¿Ganará el equipo favorito?",
      "¿Se marcará un gol antes del minuto 30?",
      "¿El equipo ganará por más de 2 goles de diferencia?",
      "¿Habrá tarjetas rojas en el partido?",
      "¿El jugador estrella marcará un gol?",
      "¿El partido irá a tiempo extra?"
    ],
    questions: {
      "¿Ganará el equipo local en el próximo partido?": [
        "¿Ganará el equipo local en el próximo partido?",
        "¿El equipo local vencerá al visitante?",
        "¿El equipo de casa ganará el encuentro?"
      ],
      "¿El equipo visitante marcará más de 2 goles?": [
        "¿El equipo visitante marcará más de 2 goles?",
        "¿El equipo de fuera anotará más de dos veces?",
        "¿El equipo visitante superará los 2 goles?"
      ],
      "¿Habrá más de 3 goles en el partido?": [
        "¿Habrá más de 3 goles en el partido?",
        "¿Se marcarán más de 3 goles en total?",
        "¿El partido tendrá más de 3 goles combinados?"
      ],
      "¿El partido terminará en empate?": [
        "¿El partido terminará en empate?",
        "¿Ambos equipos terminarán con el mismo marcador?",
        "¿El resultado será un empate?"
      ],
      "¿Ganará el equipo favorito?": [
        "¿Ganará el equipo favorito según las apuestas?",
        "¿El equipo con mejor posición ganará?",
        "¿El favorito se impondrá en el partido?"
      ],
      "¿Se marcará un gol antes del minuto 30?": [
        "¿Se marcará un gol antes del minuto 30?",
        "¿Habrá un gol en los primeros 30 minutos?",
        "¿Se anotará un gol antes de la media hora?"
      ],
      "¿El equipo ganará por más de 2 goles de diferencia?": [
        "¿El equipo ganador tendrá más de 2 goles de ventaja?",
        "¿La diferencia de goles será mayor a 2?",
        "¿El ganador superará por más de 2 goles?"
      ],
      "¿Habrá tarjetas rojas en el partido?": [
        "¿Habrá al menos una tarjeta roja en el partido?",
        "¿Se expulsará algún jugador?",
        "¿El árbitro mostrará tarjeta roja?"
      ],
      "¿El jugador estrella marcará un gol?": [
        "¿El jugador estrella marcará al menos un gol?",
        "¿El mejor jugador anotará en el partido?",
        "¿El goleador del equipo marcará?"
      ],
      "¿El partido irá a tiempo extra?": [
        "¿El partido necesitará tiempo extra?",
        "¿El encuentro se extenderá más allá de los 90 minutos?",
        "¿Habrá prórroga en el partido?"
      ]
    }
  },
  {
    id: "politica",
    name: "Política",
    icon: "🏛️",
    description: "Elecciones, decisiones políticas y eventos gubernamentales",
    titles: [
      "¿Ganará el candidato A en las próximas elecciones?",
      "¿El partido gobernante mantendrá la mayoría?",
      "¿Se aprobará la nueva ley?",
      "¿El presidente será reelegido?",
      "¿Habrá cambio de gobierno?",
      "¿La encuesta mostrará ventaja del candidato A?",
      "¿El referéndum será aprobado?",
      "¿Se formará una coalición?",
      "¿El candidato independiente ganará?",
      "¿La participación electoral superará el 60%?"
    ],
    questions: {
      "¿Ganará el candidato A en las próximas elecciones?": [
        "¿Ganará el candidato A en las próximas elecciones?",
        "¿El candidato A será elegido?",
        "¿El candidato A obtendrá la mayoría de votos?"
      ],
      "¿El partido gobernante mantendrá la mayoría?": [
        "¿El partido gobernante mantendrá la mayoría en el congreso?",
        "¿El partido en el poder conservará la mayoría?",
        "¿El partido gobernante seguirá siendo mayoría?"
      ],
      "¿Se aprobará la nueva ley?": [
        "¿Se aprobará la nueva ley en el congreso?",
        "¿La propuesta de ley será aprobada?",
        "¿La nueva legislación será sancionada?"
      ],
      "¿El presidente será reelegido?": [
        "¿El presidente actual será reelegido?",
        "¿El presidente ganará las elecciones nuevamente?",
        "¿El presidente continuará en el cargo?"
      ],
      "¿Habrá cambio de gobierno?": [
        "¿Habrá cambio de gobierno en las próximas elecciones?",
        "¿El partido en el poder perderá las elecciones?",
        "¿Se producirá una alternancia política?"
      ],
      "¿La encuesta mostrará ventaja del candidato A?": [
        "¿La próxima encuesta mostrará ventaja del candidato A?",
        "¿El candidato A liderará en las encuestas?",
        "¿Las encuestas darán ventaja al candidato A?"
      ],
      "¿El referéndum será aprobado?": [
        "¿El referéndum será aprobado por la mayoría?",
        "¿La consulta popular será aprobada?",
        "¿El referéndum tendrá resultado positivo?"
      ],
      "¿Se formará una coalición?": [
        "¿Se formará una coalición entre partidos?",
        "¿Los partidos llegarán a un acuerdo de coalición?",
        "¿Habrá una alianza política?"
      ],
      "¿El candidato independiente ganará?": [
        "¿El candidato independiente ganará las elecciones?",
        "¿El candidato sin partido será elegido?",
        "¿El independiente obtendrá la victoria?"
      ],
      "¿La participación electoral superará el 60%?": [
        "¿La participación electoral superará el 60%?",
        "¿Más del 60% de los votantes acudirá a votar?",
        "¿La participación será mayor al 60%?"
      ]
    }
  },
  {
    id: "tecnologia",
    name: "Tecnología",
    icon: "💻",
    description: "Lanzamientos, innovaciones y tendencias tecnológicas",
    titles: [
      "¿La nueva versión del producto será lanzada este año?",
      "¿La empresa alcanzará su objetivo de ventas?",
      "¿El nuevo dispositivo superará las expectativas?",
      "¿La startup recibirá más inversión?",
      "¿El producto será un éxito comercial?",
      "¿La tecnología será adoptada masivamente?",
      "¿La empresa lanzará el producto a tiempo?",
      "¿El precio será menor a $X?",
      "¿La funcionalidad estará disponible?",
      "¿El producto recibirá buenas críticas?"
    ],
    questions: {
      "¿La nueva versión del producto será lanzada este año?": [
        "¿La nueva versión del producto será lanzada este año?",
        "¿El lanzamiento ocurrirá antes de fin de año?",
        "¿El producto estará disponible este año?"
      ],
      "¿La empresa alcanzará su objetivo de ventas?": [
        "¿La empresa alcanzará su objetivo de ventas trimestrales?",
        "¿Se cumplirá la meta de ventas?",
        "¿Las ventas superarán el objetivo?"
      ],
      "¿El nuevo dispositivo superará las expectativas?": [
        "¿El nuevo dispositivo superará las expectativas de ventas?",
        "¿El producto será más exitoso de lo esperado?",
        "¿El dispositivo tendrá mejor recepción de la prevista?"
      ],
      "¿La startup recibirá más inversión?": [
        "¿La startup recibirá una nueva ronda de inversión?",
        "¿Se cerrará una ronda de financiamiento?",
        "¿La empresa obtendrá más capital?"
      ],
      "¿El producto será un éxito comercial?": [
        "¿El producto será un éxito comercial?",
        "¿El producto tendrá buenas ventas?",
        "¿El producto será bien recibido por el mercado?"
      ],
      "¿La tecnología será adoptada masivamente?": [
        "¿La tecnología será adoptada masivamente?",
        "¿La nueva tecnología tendrá adopción masiva?",
        "¿Los usuarios adoptarán la tecnología en gran número?"
      ],
      "¿La empresa lanzará el producto a tiempo?": [
        "¿La empresa lanzará el producto en la fecha anunciada?",
        "¿El lanzamiento será puntual?",
        "¿El producto estará disponible en la fecha prevista?"
      ],
      "¿El precio será menor a $X?": [
        "¿El precio de lanzamiento será menor a $X?",
        "¿El producto costará menos de $X?",
        "¿El precio será inferior a $X?"
      ],
      "¿La funcionalidad estará disponible?": [
        "¿La funcionalidad anunciada estará disponible al lanzamiento?",
        "¿La característica estará incluida?",
        "¿La función estará habilitada?"
      ],
      "¿El producto recibirá buenas críticas?": [
        "¿El producto recibirá críticas positivas?",
        "¿Las reseñas serán mayormente favorables?",
        "¿El producto tendrá buena calificación?"
      ]
    }
  },
  {
    id: "economia",
    name: "Economía",
    icon: "💰",
    description: "Mercados financieros, indicadores económicos y tendencias",
    titles: [
      "¿El precio del Bitcoin superará $X?",
      "¿La bolsa subirá este mes?",
      "¿La inflación será menor al X%?",
      "¿El dólar bajará de precio?",
      "¿La economía crecerá este trimestre?",
      "¿El banco central subirá las tasas?",
      "¿El desempleo disminuirá?",
      "¿El PIB crecerá más del X%?",
      "¿La moneda se devaluará?",
      "¿El mercado será alcista?"
    ],
    questions: {
      "¿El precio del Bitcoin superará $X?": [
        "¿El precio del Bitcoin superará $X antes de fin de mes?",
        "¿El BTC alcanzará los $X?",
        "¿El Bitcoin superará el precio de $X?"
      ],
      "¿La bolsa subirá este mes?": [
        "¿El índice de la bolsa subirá este mes?",
        "¿El mercado accionario tendrá ganancias este mes?",
        "¿Las acciones subirán en el mes?"
      ],
      "¿La inflación será menor al X%?": [
        "¿La inflación anual será menor al X%?",
        "¿El índice de inflación será inferior a X%?",
        "¿La inflación estará por debajo del X%?"
      ],
      "¿El dólar bajará de precio?": [
        "¿El dólar bajará de precio este mes?",
        "¿El tipo de cambio del dólar disminuirá?",
        "¿El dólar se depreciará?"
      ],
      "¿La economía crecerá este trimestre?": [
        "¿La economía crecerá este trimestre?",
        "¿El PIB trimestral será positivo?",
        "¿Habrá crecimiento económico este trimestre?"
      ],
      "¿El banco central subirá las tasas?": [
        "¿El banco central subirá las tasas de interés?",
        "¿Habrá un aumento en las tasas?",
        "¿Las tasas de interés aumentarán?"
      ],
      "¿El desempleo disminuirá?": [
        "¿La tasa de desempleo disminuirá este mes?",
        "¿El desempleo bajará?",
        "¿Habrá menos desempleados?"
      ],
      "¿El PIB crecerá más del X%?": [
        "¿El PIB anual crecerá más del X%?",
        "¿El crecimiento del PIB superará el X%?",
        "¿El PIB tendrá un crecimiento mayor al X%?"
      ],
      "¿La moneda se devaluará?": [
        "¿La moneda local se devaluará este mes?",
        "¿El tipo de cambio subirá?",
        "¿La moneda perderá valor?"
      ],
      "¿El mercado será alcista?": [
        "¿El mercado será alcista este mes?",
        "¿Las acciones subirán consistentemente?",
        "¿Habrá una tendencia alcista?"
      ]
    }
  },
  {
    id: "entretenimiento",
    name: "Entretenimiento",
    icon: "🎬",
    description: "Cine, música, series y eventos de entretenimiento",
    titles: [
      "¿La película recaudará más de $X millones?",
      "¿El álbum será número 1?",
      "¿La serie será renovada?",
      "¿El artista ganará el premio?",
      "¿El evento tendrá más de X asistentes?",
      "¿La película recibirá buenas críticas?",
      "¿El concierto se agotará?",
      "¿La serie superará el rating?",
      "¿El artista lanzará nuevo material?",
      "¿El premio será para el favorito?"
    ],
    questions: {
      "¿La película recaudará más de $X millones?": [
        "¿La película recaudará más de $X millones en taquilla?",
        "¿El filme superará los $X millones?",
        "¿La recaudación será mayor a $X millones?"
      ],
      "¿El álbum será número 1?": [
        "¿El álbum será número 1 en las listas?",
        "¿El disco alcanzará el primer lugar?",
        "¿El álbum liderará las ventas?"
      ],
      "¿La serie será renovada?": [
        "¿La serie será renovada para otra temporada?",
        "¿Habrá una nueva temporada?",
        "¿La serie continuará?"
      ],
      "¿El artista ganará el premio?": [
        "¿El artista ganará el premio principal?",
        "¿El artista recibirá el galardón?",
        "¿El premio será para el artista?"
      ],
      "¿El evento tendrá más de X asistentes?": [
        "¿El evento tendrá más de X asistentes?",
        "¿La asistencia superará X personas?",
        "¿Habrá más de X asistentes?"
      ],
      "¿La película recibirá buenas críticas?": [
        "¿La película recibirá críticas positivas?",
        "¿Las reseñas serán favorables?",
        "¿La película tendrá buena calificación?"
      ],
      "¿El concierto se agotará?": [
        "¿El concierto se agotará antes del evento?",
        "¿Las entradas se venderán completamente?",
        "¿El concierto estará lleno?"
      ],
      "¿La serie superará el rating?": [
        "¿La serie superará el rating de la temporada anterior?",
        "¿Los ratings serán mejores?",
        "¿La serie tendrá más audiencia?"
      ],
      "¿El artista lanzará nuevo material?": [
        "¿El artista lanzará nuevo material este año?",
        "¿Habrá un nuevo lanzamiento?",
        "¿El artista publicará nuevo contenido?"
      ],
      "¿El premio será para el favorito?": [
        "¿El premio será para el favorito?",
        "¿El favorito ganará el premio?",
        "¿El premio irá al favorito?"
      ]
    }
  },
  {
    id: "clima",
    name: "Clima",
    icon: "🌤️",
    description: "Pronósticos del tiempo y fenómenos climáticos",
    titles: [
      "¿Lloverá mañana?",
      "¿La temperatura superará los X grados?",
      "¿Habrá tormenta este fin de semana?",
      "¿El invierno será más frío de lo normal?",
      "¿Habrá sequía este año?",
      "¿La temporada de lluvias será intensa?",
      "¿Habrá heladas este mes?",
      "¿El verano será más caluroso?",
      "¿Habrá huracán en la región?",
      "¿La temperatura mínima será menor a X grados?"
    ],
    questions: {
      "¿Lloverá mañana?": [
        "¿Lloverá mañana en la región?",
        "¿Habrá precipitaciones mañana?",
        "¿Caerá lluvia mañana?"
      ],
      "¿La temperatura superará los X grados?": [
        "¿La temperatura máxima superará los X grados?",
        "¿Hará más de X grados?",
        "¿La temperatura será mayor a X grados?"
      ],
      "¿Habrá tormenta este fin de semana?": [
        "¿Habrá tormenta este fin de semana?",
        "¿Se producirá una tormenta?",
        "¿Habrá actividad tormentosa?"
      ],
      "¿El invierno será más frío de lo normal?": [
        "¿El invierno será más frío de lo normal?",
        "¿Las temperaturas invernales serán menores?",
        "¿El invierno será más severo?"
      ],
      "¿Habrá sequía este año?": [
        "¿Habrá sequía este año en la región?",
        "¿La sequía afectará la zona?",
        "¿Faltará lluvia este año?"
      ],
      "¿La temporada de lluvias será intensa?": [
        "¿La temporada de lluvias será más intensa de lo normal?",
        "¿Habrá más lluvia de lo habitual?",
        "¿Las precipitaciones serán abundantes?"
      ],
      "¿Habrá heladas este mes?": [
        "¿Habrá heladas este mes?",
        "¿Se producirán heladas?",
        "¿La temperatura bajará a punto de congelación?"
      ],
      "¿El verano será más caluroso?": [
        "¿El verano será más caluroso de lo normal?",
        "¿Las temperaturas veraniegas serán mayores?",
        "¿Hará más calor este verano?"
      ],
      "¿Habrá huracán en la región?": [
        "¿Habrá un huracán en la región este año?",
        "¿Se formará un huracán?",
        "¿La región será afectada por un huracán?"
      ],
      "¿La temperatura mínima será menor a X grados?": [
        "¿La temperatura mínima será menor a X grados?",
        "¿Bajará de X grados?",
        "¿La mínima será inferior a X grados?"
      ]
    }
  },
  {
    id: "otros",
    name: "Otros",
    icon: "📌",
    description: "Otras categorías y temas diversos",
    titles: [
      "¿El evento ocurrirá en la fecha prevista?",
      "¿Se cumplirá el objetivo?",
      "¿La propuesta será aceptada?",
      "¿Habrá cambios este mes?",
      "¿El resultado será positivo?",
      "¿Se alcanzará la meta?",
      "¿La decisión será favorable?",
      "¿El proyecto será completado?",
      "¿La situación mejorará?",
      "¿El plazo se cumplirá?"
    ],
    questions: {
      "¿El evento ocurrirá en la fecha prevista?": [
        "¿El evento ocurrirá en la fecha prevista?",
        "¿El evento se realizará a tiempo?",
        "¿El evento será en la fecha programada?"
      ],
      "¿Se cumplirá el objetivo?": [
        "¿Se cumplirá el objetivo establecido?",
        "¿Se alcanzará la meta?",
        "¿El objetivo será logrado?"
      ],
      "¿La propuesta será aceptada?": [
        "¿La propuesta será aceptada?",
        "¿Se aprobará la propuesta?",
        "¿La propuesta tendrá éxito?"
      ],
      "¿Habrá cambios este mes?": [
        "¿Habrá cambios significativos este mes?",
        "¿Se producirán cambios?",
        "¿Ocurrirán cambios?"
      ],
      "¿El resultado será positivo?": [
        "¿El resultado será positivo?",
        "¿El resultado será favorable?",
        "¿El resultado será exitoso?"
      ],
      "¿Se alcanzará la meta?": [
        "¿Se alcanzará la meta establecida?",
        "¿La meta será cumplida?",
        "¿Se logrará el objetivo?"
      ],
      "¿La decisión será favorable?": [
        "¿La decisión será favorable?",
        "¿La decisión será positiva?",
        "¿La decisión será aprobada?"
      ],
      "¿El proyecto será completado?": [
        "¿El proyecto será completado a tiempo?",
        "¿El proyecto finalizará?",
        "¿El proyecto estará terminado?"
      ],
      "¿La situación mejorará?": [
        "¿La situación mejorará este mes?",
        "¿Habrá una mejora?",
        "¿La situación será mejor?"
      ],
      "¿El plazo se cumplirá?": [
        "¿El plazo se cumplirá?",
        "¿Se cumplirá el tiempo establecido?",
        "¿El plazo será respetado?"
      ]
    }
  }
]

// Función helper para obtener preguntas sugeridas
export function getSuggestedQuestions(categoryId: string, title: string): string[] {
  const category = PREDICTION_CATEGORIES.find(c => c.id === categoryId)
  if (!category) return []
  
  return category.questions[title] || []
}

// Función helper para obtener títulos sugeridos
export function getSuggestedTitles(categoryId: string): string[] {
  const category = PREDICTION_CATEGORIES.find(c => c.id === categoryId)
  return category?.titles || []
}

# 🏆 BotRANK — Bot de Ranking de Clan

Bot de Discord para rastrear y mostrar puntos de clan automáticamente a partir de mensajes de webhook. Genera imágenes de ranking con canvas, exporta eventos a Excel, y gestiona un historial completo de eventos.

---

## ✅ Requisitos

- Node.js v18 o superior
- Una base de datos PostgreSQL — opciones gratuitas recomendadas:
  - [Supabase](https://supabase.com) ← recomendado
  - [Neon](https://neon.tech)
  - [Railway](https://railway.app)
- Un bot creado en el [Discord Developer Portal](https://discord.com/developers/applications)

---

## ⚙️ Instalación

```bash
npm install
```

Copia el archivo `.env.example`, renómbralo a `.env` y completá todos los valores.

Asegurate de tener el archivo `Poppins-Bold.ttf` en la raíz del proyecto (junto a `index.js`). Sin esta fuente el canvas usa una fuente de respaldo pero se ve diferente.

---

## 🔑 Variables de entorno

| Variable | Descripción |
|---|---|
| `DISCORD_TOKEN` | Token del bot (Discord Developer Portal) |
| `GUILD_ID` | ID del servidor de Discord |
| `CHANNEL_ID` | Canal donde llegan los mensajes del webhook con los puntos |
| `RANKING_CHANNEL_ID` | Canal donde se publica el ranking y los anuncios de eventos |
| `EVENTS_CHANNEL_ID` | Canal donde se publica el podio al cerrar un evento |
| `HISTORICO_CHANNEL_ID` | Canal donde se publica el Salón de Honor |
| `LOGS_CHANNEL_ID` | Canal donde se suben los Excel de eventos históricos |
| `RESET_MESSAGE_ID` | ID del mensaje desde donde empezar a contar puntos |
| `TIMEZONE` | Zona horaria para el reporte diario (ej: `America/Argentina/Buenos_Aires`) |
| `PGHOST` | Host de la base de datos |
| `PGUSER` | Usuario de la base de datos |
| `PGPASSWORD` | Contraseña de la base de datos |
| `PGDATABASE` | Nombre de la base de datos |
| `PGPORT` | Puerto (por defecto: `5432`) |

### Conexión con Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **Settings → Database → Connection parameters**
3. Copiar los valores en el `.env`

> Si usás Supabase, agregá `max: 5` al pool en `src/db/pool.js` para no superar el límite de conexiones del plan gratuito.

---

## 🤖 Permisos necesarios del bot

En el Discord Developer Portal activar los siguientes permisos:

- `Send Messages`
- `Read Message History`
- `Manage Messages` (para pinear el ranking)
- `Embed Links`
- `Attach Files` (para el canvas y los Excel)
- `Use Slash Commands`

En **Privileged Gateway Intents** activar:
- `MESSAGE CONTENT INTENT`

---

## 📁 Estructura del proyecto

```
bot/
├── index.js                      ← Entrada principal + keep-alive
├── package.json
├── .env.example
├── Poppins-Bold.ttf              ← Fuente para el canvas (agregar manualmente)
│
└── src/
    ├── client.js                 ← Cliente de Discord
    ├── commands/
    │   └── index.js              ← Definición y registro de slash commands
    ├── db/
    │   ├── pool.js               ← Conexión PostgreSQL
    │   └── setup.js              ← Creación automática de todas las tablas
    ├── canvas/
    │   └── rankingCard.js        ← Generador de imagen del ranking
    ├── excel/
    │   └── eventoExcel.js        ← Generador de Excel para eventos
    ├── services/
    │   ├── sync.js               ← Procesamiento de webhooks y sincronización
    │   ├── ranking.js            ← Post del ranking y ranking de evento
    │   ├── reporteDiario.js      ← Reporte automático diario
    │   └── salonHonor.js         ← Salón de honor global
    ├── handlers/
    │   ├── interactions.js       ← Router principal de interacciones
    │   ├── commands.js           ← Lógica de slash commands
    │   ├── buttons.js            ← Lógica de botones
    │   ├── modals.js             ← Lógica de modales
    │   └── selects.js            ← Lógica de select menus
    └── utils/
        ├── format.js             ← fmtNum, formatDate, formatDuration
        └── messages.js           ← Extracción de puntos y fetch de mensajes
```

---

## 🎮 Comandos disponibles

### Públicos

| Comando | Descripción |
|---|---|
| `/rankclan` | Muestra el ranking completo con paginación |
| `/estadisticas` | Resumen general del clan (MVP, promedio, total, evento activo) |
| `/evento-estado` | Ranking parcial del evento activo con tiempo transcurrido |
| `/salon-de-honor` | Top histórico global del clan en canvas |
| `/consultar-evento` | Re-exporta el Excel de un evento histórico guardado |

### Admin — Rank general

| Comando | Descripción |
|---|---|
| `/calcular-inicio [message_id]` | Resincroniza puntos desde un mensaje específico |
| `/reiniciar-rank` | ⚠️ Borra todos los puntos del ranking general |
| `/evento-temporada` | Cambia el nombre de la temporada en el ranking |

### Admin — Evento activo

| Comando | Descripción |
|---|---|
| `/iniciar-evento` | Abre un modal para crear y anunciar un nuevo evento. Permite especificar un ID de inicio opcional |
| `/cerrar-evento` | Cierra el evento activo, calcula los puntos y publica el podio automáticamente |
| `/excluir-de-evento [usuario]` | Oculta a un usuario del ranking visible del evento (sus puntos siguen contando) |
| `/incluir-en-evento [usuario]` | Vuelve a mostrar a un usuario excluido |

### Admin — Histórico

| Comando | Descripción |
|---|---|
| `/calcular-evento-historico` | Escanea un rango de IDs, guarda el evento en el histórico y genera un Excel |
| `/borrar-evento` | Borra un evento histórico y descuenta sus puntos del salón de honor global |

---

## ✨ Funciones automáticas

**Ranking canvas** — Cada 5 minutos el bot actualiza una imagen generada con canvas que muestra el top 10 del clan con barras de progreso y medallas doradas/plateadas/bronce.

**Ranking de evento en vivo** — Mientras hay un evento activo, se publica y actualiza automáticamente un embed con el ranking parcial del evento.

**Reporte diario** — A medianoche (según la `TIMEZONE` configurada) el bot publica un embed con el MVP del día, el top de aportadores y el total del clan.

**Podio automático** — Al usar `/cerrar-evento`, el bot lee todos los mensajes del evento, calcula los puntos, y publica un embed con MVP, top 10, total del clan, participantes y duración.

**Excel de eventos** — Al calcular un evento histórico con `/calcular-evento-historico`, se genera automáticamente un archivo `.xlsx` con estilos y estadísticas y se sube al canal de logs.

---

## 📝 Detección de mensajes

El bot detecta automáticamente mensajes de webhook con estos formatos:

```
(Usuario ha conseguido 10.000 puntos para este clan)
Usuario ha conseguido 1.000 puntos para este clan
```

También detecta el total acumulado del clan en mensajes del tipo:

```
El clan ahora tiene 21.769.639 puntos de experiencia
```

---

## 🚀 Uso con múltiples servidores

El bot soporta múltiples servidores de forma nativa. Los datos de cada servidor están separados por `guild_id` en todas las tablas.

Para correr el bot en dos servidores distintos, creá **dos deploys separados**, cada uno con su propio `.env` apuntando al servidor y canales correspondientes. Pueden compartir la misma base de datos sin conflictos.

---

## 🗄️ Tablas de la base de datos

El bot crea todas las tablas automáticamente al iniciar. No es necesario ejecutar ningún SQL manualmente.

| Tabla | Descripción |
|---|---|
| `puntos` | Puntos acumulados por usuario en el ranking general |
| `clan_stats` | Total del clan, último ID procesado y nombre de temporada |
| `puntos_diarios` | Puntos por usuario por día (para el reporte diario) |
| `eventos` | Eventos activos e históricos con su estado |
| `puntos_evento` | Puntos por usuario dentro de cada evento activo |
| `excluidos_evento` | Usuarios excluidos del ranking visible de un evento |
| `eventos_historicos` | Registro de eventos calculados con IDs de rango |
| `puntos_historicos` | Puntos por usuario dentro de cada evento histórico |
| `historico_global` | Suma acumulada de puntos históricos por usuario (salón de honor) |

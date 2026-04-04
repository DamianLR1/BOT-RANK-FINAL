// ==========================================
// KEEP-ALIVE
// ==========================================
const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('Bot activo'); })
  .listen(port, () => console.log(`🌍 Keep-Alive en puerto ${port}`));

// ==========================================
// INICIO DEL BOT
// ==========================================
const { client }      = require('./src/client');
const { setupDb }     = require('./src/db/setup');
const { registerCommands } = require('./src/commands');
const { syncRecentPoints } = require('./src/services/sync');
const { postRankingMessage, postEventRankingMessage } = require('./src/services/ranking');
const { programarReporteDiario } = require('./src/services/reporteDiario');
const { programarRotacionDiaria } = require('./src/services/registroDiario');
const { pool }        = require('./src/db/pool');
require('./src/handlers/interactions');
require('./src/handlers/messages');
require('dotenv').config();

client.once('ready', async () => {
  console.log(`✅ Bot conectado: ${client.user.tag}`);

  await registerCommands(client);
  await syncRecentPoints(process.env.CHANNEL_ID, process.env.GUILD_ID);
  await postRankingMessage();

  const evActivo = await pool.query(
    `SELECT id FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`,
    [process.env.GUILD_ID]
  );
  if (evActivo.rows.length) await postEventRankingMessage();

  setInterval(postRankingMessage, 5 * 60 * 1000);
  setInterval(async () => {
    const ev = await pool.query(
      `SELECT id FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`,
      [process.env.GUILD_ID]
    );
    if (ev.rows.length) await postEventRankingMessage();
  }, 5 * 60 * 1000);

  programarReporteDiario();
  programarRotacionDiaria();
});

(async () => {
  try {
    await setupDb();
    console.log('Iniciando Discord...');
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  }
})();

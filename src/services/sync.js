const { pool } = require('../db/pool');
const { client } = require('../client');
const { extractPointsFromMessage, fetchMessagesAfter } = require('../utils/messages');

async function processWebhookMessage(message) {
  if (!message.guild?.id || !message.webhookId || !message.embeds?.length) return;
  const description = message.embeds[0].description || message.embeds[0].title || '';
  const guildId = message.guild.id;
  const extracted = extractPointsFromMessage(message);

  if (extracted) {
    const { usuario, puntos } = extracted;
    try {
      await pool.query(
        `INSERT INTO puntos (guild,usuario,puntos) VALUES ($1,$2,$3)
         ON CONFLICT (guild,usuario) DO UPDATE SET puntos=puntos.puntos+$3`,
        [guildId, usuario, puntos]
      );
      const hoy = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO puntos_diarios (guild,usuario,fecha,puntos) VALUES ($1,$2,$3,$4)
         ON CONFLICT (guild,usuario,fecha) DO UPDATE SET puntos=puntos_diarios.puntos+$4`,
        [guildId, usuario, hoy, puntos]
      );
      const ev = await pool.query(
        `SELECT id FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]
      );
      if (ev.rows.length) {
        await pool.query(
          `INSERT INTO puntos_evento (evento_id,guild,usuario,puntos) VALUES ($1,$2,$3,$4)
           ON CONFLICT (evento_id,guild,usuario) DO UPDATE SET puntos=puntos_evento.puntos+$4`,
          [ev.rows[0].id, guildId, usuario, puntos]
        );
      }
      console.log(`[PROCESS] ${usuario} +${puntos} (ID:${message.id})`);
    } catch (err) { console.error('[PROCESS] Error:', err.message); }
  }

  const mTotal = description.match(/ahora tiene\s+([0-9,.]+)\s+puntos de experiencia/si);
  if (mTotal) {
    const total = BigInt(mTotal[1].replace(/[,.]/g, ''));
    try {
      await pool.query(
        `INSERT INTO clan_stats (guild,total_puntos) VALUES ($1,$2)
         ON CONFLICT (guild) DO UPDATE SET total_puntos=$2`,
        [guildId, total]
      );
    } catch (err) { console.error('[PROCESS] Error total:', err.message); }
  }
}

async function syncRecentPoints(channelId, guildId) {
  console.log('[SYNC] Iniciando...');
  try {
    const r = await pool.query('SELECT last_processed_message_id FROM clan_stats WHERE guild=$1', [guildId]);
    let lastId = r.rows[0]?.last_processed_message_id || process.env.RESET_MESSAGE_ID;
    if (!lastId) { console.warn('[SYNC] Sin ID de inicio'); return; }

    const channel = await client.channels.fetch(channelId);
    if (!channel?.messages) return;

    const messages = await fetchMessagesAfter(channel, lastId, 2000);
    if (!messages.length) { console.log('[SYNC] Sin mensajes nuevos'); return; }

    let newest = lastId;
    for (const msg of messages) {
      await processWebhookMessage(msg);
      if (BigInt(msg.id) > BigInt(newest)) newest = msg.id;
    }
    await pool.query(`UPDATE clan_stats SET last_processed_message_id=$1 WHERE guild=$2`, [newest, guildId]);
    console.log(`[SYNC] ${messages.length} mensajes procesados. Último: ${newest}`);
  } catch (err) { console.error('[SYNC] Error:', err); }
}

module.exports = { processWebhookMessage, syncRecentPoints };

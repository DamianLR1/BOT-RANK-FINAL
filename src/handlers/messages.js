const { client } = require('../client');
const { pool } = require('../db/pool');
const { processWebhookMessage } = require('../services/sync');

client.on('messageCreate', async (message) => {
  if (message.channel.id !== process.env.CHANNEL_ID) return;
  await processWebhookMessage(message);
  if (message.guild?.id) {
    try {
      await pool.query(
        `UPDATE clan_stats SET last_processed_message_id=$1 WHERE guild=$2`,
        [message.id, message.guild.id]
      );
    } catch(e) { console.error('[MessageCreate] Error:', e.message); }
  }
});

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { generarRankingCanvas } = require('../canvas/rankingCard');
const { fmtNum } = require('../utils/format');

async function postSalonDeHonor(guild, modo = 'todos') {
  try {
    const channel = await client.channels.fetch(process.env.HISTORICO_CHANNEL_ID);
    if (!channel) { console.warn('[SALON] Canal HISTORICO_CHANNEL_ID no encontrado'); return; }

    let query;
    if (modo === 'marcados') {
      query = await pool.query(
        `SELECT ph.usuario, SUM(ph.puntos) as puntos FROM puntos_historicos ph
         INNER JOIN eventos_historicos eh ON ph.evento_id=eh.id
         WHERE ph.guild=$1 AND eh.contar_en_global=true
         GROUP BY ph.usuario ORDER BY puntos DESC LIMIT 10`,
        [guild.id]
      );
    } else {
      query = await pool.query(
        `SELECT usuario, SUM(puntos) as puntos FROM puntos_historicos
         WHERE guild=$1 GROUP BY usuario ORDER BY puntos DESC LIMIT 10`,
        [guild.id]
      );
    }

    const totalR = await pool.query(`SELECT SUM(puntos) as total FROM puntos_historicos WHERE guild=$1`, [guild.id]);
    const countR = await pool.query(`SELECT COUNT(*) FROM eventos_historicos WHERE guild=$1`, [guild.id]);

    const imageBuffer = await generarRankingCanvas({
      usuarios: query.rows.map(r => ({ usuario: r.usuario, puntos: Number(r.puntos) })),
      temporada: modo === 'marcados' ? 'Salon de Honor (seleccionados)' : 'Salon de Honor Global',
      totalPuntos: Number(totalR.rows[0]?.total || 0),
      guildIconURL: guild.iconURL({ extension: 'png', size: 128 })
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'salon-honor.png' });
    const embed = new EmbedBuilder()
      .setTitle('🏛️ Salon de Honor')
      .setDescription(`Modo: **${modo === 'marcados' ? 'Solo eventos marcados' : 'Todos los eventos'}**\nEventos registrados: **${countR.rows[0].count}**`)
      .setColor('#D4AF37').setTimestamp();

    await channel.send({ embeds: [embed], files: [attachment] });
    console.log('[SALON] Publicado');
  } catch (err) { console.error('[SALON] Error:', err.message); }
}

module.exports = { postSalonDeHonor };

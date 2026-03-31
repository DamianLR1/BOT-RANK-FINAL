const { EmbedBuilder } = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { fmtNum } = require('../utils/format');

async function publicarReporteDiario() {
  try {
    const ayer = new Date(); ayer.setDate(ayer.getDate()-1);
    const fechaAyer = ayer.toISOString().split('T')[0];

    for (const [guildId] of client.guilds.cache) {
      const r = await pool.query(
        `SELECT usuario,puntos FROM puntos_diarios WHERE guild=$1 AND fecha=$2 ORDER BY puntos DESC LIMIT 10`,
        [guildId, fechaAyer]
      );
      if (!r.rows.length) continue;

      const total = r.rows.reduce((a,b) => a+b.puntos, 0);
      const mvp = r.rows[0];
      const medallas = ['🥇','🥈','🥉'];
      const lines = r.rows.map((row,i) => `${medallas[i]||`**${i+1}.**`} **${row.usuario}** — \`${fmtNum(row.puntos)} pts\``).join('\n');
      const fechaFmt = new Intl.DateTimeFormat('es', {
        day:'2-digit', month:'long', year:'numeric',
        timeZone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'
      }).format(ayer);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Reporte Diario — ${fechaFmt}`).setColor('#F1C40F')
        .addFields(
          { name: '🌟 MVP del dia', value: `**${mvp.usuario}** — \`${fmtNum(mvp.puntos)} pts\`` },
          { name: '🏆 Top aportadores', value: lines },
          { name: '⚡ Total del clan hoy', value: `\`${fmtNum(total)} pts\``, inline: true }
        ).setTimestamp().setFooter({ text: 'Reporte automatico' });

      try {
        const channel = await client.channels.fetch(process.env.RANKING_CHANNEL_ID);
        if (channel) await channel.send({ embeds: [embed] });
      } catch(e) { console.error(`[REPORTE DIARIO] Error enviando a ${guildId}:`, e.message); }
    }
  } catch (err) { console.error('[REPORTE DIARIO]', err); }
}

function programarReporteDiario() {
  const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const manana = new Date(ahora); manana.setDate(manana.getDate()+1); manana.setHours(0,0,30,0);
  const ms = manana - ahora;
  console.log(`[REPORTE DIARIO] Próximo en ${Math.round(ms/60000)} min`);
  setTimeout(async () => {
    await publicarReporteDiario();
    setInterval(publicarReporteDiario, 86400000);
  }, ms);
}

module.exports = { publicarReporteDiario, programarReporteDiario };

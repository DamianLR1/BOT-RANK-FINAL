const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { pool } = require('../db/pool');
const { postRankingMessage, postEventRankingMessage } = require('../services/ranking');
const { fmtNum } = require('../utils/format');

async function handleButtons(interaction) {
  const { customId } = interaction;
  const guildId = interaction.guild.id;

  // ── Actualizar ranking general ─────────────────────────────
  if (customId === 'refresh_ranking') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    await postRankingMessage();
    await interaction.editReply({ content: '✅ Ranking actualizado.' });
    return;
  }

  // ── Actualizar ranking del evento ──────────────────────────
  if (customId === 'refresh_event_ranking') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    await postEventRankingMessage();
    await interaction.editReply({ content: '✅ Ranking del evento actualizado.' });
    return;
  }

  // ── Ver ranking completo paginado ──────────────────────────
  if (customId === 'view_full_ranking') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    let page = 0;
    const pageSize = 10;
    const total = parseInt((await pool.query('SELECT COUNT(*) FROM puntos WHERE guild=$1', [guildId])).rows[0].count);
    const totalPages = Math.ceil(total/pageSize)||1;

    const show = async (p) => {
      const r = await pool.query(
        'SELECT usuario,puntos FROM puntos WHERE guild=$1 ORDER BY puntos DESC LIMIT $2 OFFSET $3',
        [guildId, pageSize, p*pageSize]
      );
      const lines = r.rows.map((row,i) => `${p*pageSize+i+1}. **${row.usuario}** — ${fmtNum(row.puntos)} pts`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_full').setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(p===0),
        new ButtonBuilder().setCustomId('next_full').setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(p>=totalPages-1)
      );
      await interaction.editReply({ content: `🏆 **Ranking completo (${p+1}/${totalPages}):**\n\n${lines.join('\n')||'Vacío'}`, components: [row] });
    };
    await show(page);
    const c = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id===interaction.user.id && ['prev_full','next_full'].includes(i.customId),
      time: 60000
    });
    c.on('collect', async i => { if(i.customId==='prev_full') page--; else page++; await i.deferUpdate(); await show(page); });
    c.on('end', () => interaction.editReply({ components: [] }).catch(()=>{}));
    return;
  }

  // ── Ver ranking del evento paginado ───────────────────────
  if (customId === 'view_event_ranking') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const evR = await pool.query(`SELECT id,nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
      if (!evR.rows.length) return interaction.editReply({ content: '📭 Sin evento activo.' });
      const ev = evR.rows[0];

      const exclR = await pool.query(`SELECT usuario FROM excluidos_evento WHERE evento_id=$1`, [ev.id]);
      const excluidos = new Set(exclR.rows.map(r => r.usuario));

      const allRows = (await pool.query(
        `SELECT usuario,puntos FROM puntos_evento WHERE evento_id=$1 AND guild=$2 ORDER BY puntos DESC`,
        [ev.id, guildId]
      )).rows;
      const totalClan = allRows.reduce((a,b)=>a+Number(b.puntos),0);
      const filtrados = allRows.filter(r => !excluidos.has(r.usuario));

      let page = 0;
      const pageSize = 10;
      const totalPages = Math.ceil(filtrados.length/pageSize)||1;

      const show = async (p) => {
        const pageRows = filtrados.slice(p*pageSize, (p+1)*pageSize);
        const lines = pageRows.map((r,i) => `${p*pageSize+i+1}. **${r.usuario}** — ${fmtNum(r.puntos)} pts`);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev_ev').setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(p===0),
          new ButtonBuilder().setCustomId('next_ev').setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(p>=totalPages-1)
        );
        let footer = `Total del clan: ${fmtNum(totalClan)} pts`;
        if (excluidos.size) footer += ` · ${excluidos.size} excluido(s)`;
        await interaction.editReply({
          content: `🏆 **${ev.nombre} (${p+1}/${totalPages}):**\n\n${lines.join('\n')||'Vacío'}\n\n*${footer}*`,
          components: [row]
        });
      };
      await show(page);
      const c = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id===interaction.user.id && ['prev_ev','next_ev'].includes(i.customId),
        time: 60000
      });
      c.on('collect', async i => { if(i.customId==='prev_ev') page--; else page++; await i.deferUpdate(); await show(page); });
      c.on('end', () => interaction.editReply({ components: [] }).catch(()=>{}));
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
    return;
  }
}

module.exports = { handleButtons };

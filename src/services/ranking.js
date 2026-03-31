const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { generarRankingCanvas } = require('../canvas/rankingCard');
const { fmtNum } = require('../utils/format');

let rankingMessage = null;
let eventRankingMessage = null;

function getRankingMessage() { return rankingMessage; }
function getEventRankingMessage() { return eventRankingMessage; }
function setEventRankingMessage(msg) { eventRankingMessage = msg; }

const postRankingMessage = async () => {
  try {
    const channel = await client.channels.fetch(process.env.RANKING_CHANNEL_ID);
    if (!channel) return;
    const guild = channel.guild;

    const rUsuarios = await pool.query('SELECT usuario,puntos FROM puntos WHERE guild=$1 ORDER BY puntos DESC LIMIT 10', [guild.id]);
    const rStats = await pool.query('SELECT total_puntos,temporada_nombre FROM clan_stats WHERE guild=$1', [guild.id]);
    const stats = rStats.rows[0] || { total_puntos: 0, temporada_nombre: 'TEMPORADA' };

    const imageBuffer = await generarRankingCanvas({
      usuarios: rUsuarios.rows,
      temporada: stats.temporada_nombre || 'TEMPORADA',
      totalPuntos: Number(stats.total_puntos || 0),
      guildIconURL: guild.iconURL({ extension: 'png', size: 128 })
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'ranking.png' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('refresh_ranking').setLabel('Actualizar').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('view_full_ranking').setLabel('Ver mas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('view_event_ranking').setLabel('Ranking Evento').setStyle(ButtonStyle.Success)
    );

    if (!rankingMessage) {
      const pinned = await channel.messages.fetchPinned();
      rankingMessage = pinned.find(m => m.author.id === client.user.id && m.attachments.some(a => a.name === 'ranking.png'));
    }
    if (!rankingMessage) {
      const msg = await channel.send({ files: [attachment], components: [row] });
      await msg.pin(); rankingMessage = msg;
    } else {
      await rankingMessage.edit({ files: [attachment], components: [row] });
    }
  } catch (err) { console.error('[postRanking] Error:', err.message); }
};

const postEventRankingMessage = async () => {
  try {
    const guildId = process.env.GUILD_ID;
    const evR = await pool.query(`SELECT id,nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
    if (!evR.rows.length) return;
    const evento = evR.rows[0];

    const exclR = await pool.query(`SELECT usuario FROM excluidos_evento WHERE evento_id=$1`, [evento.id]);
    const excluidos = new Set(exclR.rows.map(r => r.usuario));

    const channel = await client.channels.fetch(process.env.RANKING_CHANNEL_ID);
    if (!channel) return;

    if (!eventRankingMessage) {
      const pinned = await channel.messages.fetchPinned();
      eventRankingMessage = pinned.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes('Ranking —'));
    }

    const result = await pool.query(
      'SELECT usuario,puntos FROM puntos_evento WHERE evento_id=$1 AND guild=$2 ORDER BY puntos DESC LIMIT 20',
      [evento.id, guildId]
    );
    const visibles = result.rows.filter(r => !excluidos.has(r.usuario)).slice(0, 10);
    const topPoints = visibles.length ? visibles[0].puntos : 1;
    const medallas = ['🥇','🥈','🥉'];

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'EVENTO EN CURSO' })
      .setTitle(`Ranking — ${evento.nombre}`)
      .setColor('#FF5733').setTimestamp();

    if (!visibles.length) { embed.setDescription('Sin puntos aún.'); }
    else {
      const lines = visibles.map((row, i) => {
        const rank = medallas[i] || `**${i+1}.**`;
        const bar = '█'.repeat(Math.round((row.puntos/topPoints)*10)) + '░'.repeat(10-Math.round((row.puntos/topPoints)*10));
        return `${rank} **${row.usuario}**\n   \`${fmtNum(row.puntos)} pts\` \`[${bar}]\``;
      }).join('\n\n');
      embed.setDescription(lines);
    }
    if (excluidos.size > 0) embed.setFooter({ text: `${excluidos.size} usuario(s) excluido(s) del ranking visible` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('refresh_event_ranking').setLabel('Actualizar evento').setStyle(ButtonStyle.Success)
    );

    if (!eventRankingMessage) {
      const msg = await channel.send({ embeds: [embed], components: [row] });
      await msg.pin(); eventRankingMessage = msg;
    } else {
      await eventRankingMessage.edit({ embeds: [embed], components: [row] });
    }
  } catch (err) { console.error('[postEventRanking] Error:', err.message); }
};

module.exports = {
  postRankingMessage, postEventRankingMessage,
  getRankingMessage, getEventRankingMessage, setEventRankingMessage
};

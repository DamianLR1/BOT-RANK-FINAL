const { EmbedBuilder, MessageFlags } = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { postRankingMessage, postEventRankingMessage } = require('../services/ranking');
const { fetchMessagesAfter, fetchMessagesBetween, extractPointsFromMessage } = require('../utils/messages');

async function handleModals(interaction) {
  const { customId } = interaction;
  const guildId = interaction.guild.id;

  // ── Cambiar nombre de temporada ────────────────────────────
  if (customId === 'evento-temporada-modal') {
    const nombre = interaction.fields.getTextInputValue('evento_nombre').trim();
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      await pool.query(`UPDATE clan_stats SET temporada_nombre=$1 WHERE guild=$2`, [nombre, guildId]);
      await postRankingMessage();
      await interaction.editReply({ content: `✅ Temporada actualizada: \`${nombre}\`` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── Iniciar evento ─────────────────────────────────────────
  if (customId.startsWith('iniciar-evento-modal')) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      // El nombre viene embebido en el customId: "iniciar-evento-modal::NombreEvento"
      const nombre   = customId.split('::')[1] || 'Evento';
      const comienzo = interaction.fields.getTextInputValue('comienzo').trim();
      const termina  = interaction.fields.getTextInputValue('termina').trim();
      const premios  = interaction.fields.getTextInputValue('premios').trim();
      const startIdRaw = interaction.fields.getTextInputValue('start_id').trim();
      const endIdRaw   = interaction.fields.getTextInputValue('end_id').trim();

      const ch = await client.channels.fetch(process.env.CHANNEL_ID);

      // ── Determinar ID de inicio ──
      // Si está vacío → usar el último mensaje del canal como punto de inicio
      // (el evento contará solo mensajes NUEVOS desde ahora)
      let startMessageId = startIdRaw;
      if (!startMessageId) {
        const last = await ch.messages.fetch({ limit: 1 });
        startMessageId = last.first()?.id || process.env.RESET_MESSAGE_ID;
      }

      // ── Determinar ID de fin ──
      // Si está vacío → usar el último mensaje del canal (carga hasta el presente)
      // Si se especifica → cargar solo hasta ese ID
      let endMessageId = endIdRaw;
      if (!endMessageId) {
        const last = await ch.messages.fetch({ limit: 1 });
        endMessageId = last.first()?.id || startMessageId;
      }

      // Crear evento en DB
      const evR = await pool.query(
        `INSERT INTO eventos (guild,nombre,start_message_id,inicio,inicio_texto,fin_texto,activo)
         VALUES ($1,$2,$3,NOW(),$4,$5,true) RETURNING id`,
        [guildId, nombre, startMessageId, comienzo, termina]
      );
      const eventoId = evR.rows[0].id;

      // Si se proporcionó al menos un ID (inicio o fin), cargar puntos históricos del rango
      if (startIdRaw || endIdRaw) {
        const label = endIdRaw
          ? `entre \`${startMessageId}\` y \`${endMessageId}\``
          : `desde \`${startMessageId}\` hasta el último mensaje`;
        await interaction.editReply({ content: `⏳ Cargando histórico ${label}...` });

        const msgs = await fetchMessagesBetween(ch, startMessageId, endMessageId);
        const pm = new Map();
        msgs.forEach(m => {
          const ex = extractPointsFromMessage(m);
          if (ex) pm.set(ex.usuario, (pm.get(ex.usuario) || 0) + ex.puntos);
        });
        for (const [u, p] of pm) {
          await pool.query(
            `INSERT INTO puntos_evento (evento_id,guild,usuario,puntos) VALUES ($1,$2,$3,$4)
             ON CONFLICT (evento_id,guild,usuario) DO UPDATE SET puntos=puntos_evento.puntos+$4`,
            [eventoId, guildId, u, p]
          );
        }
        console.log(`[INICIAR-EVENTO] Histórico cargado: ${pm.size} usuarios, ${msgs.length} mensajes`);
      }

      // Publicar anuncio del evento
      const embed = new EmbedBuilder()
        .setColor('#FF5733').setTitle(`Nuevo Evento — ${nombre}`)
        .setDescription(`@everyone Un nuevo evento ha comenzado!\nPrepárense para dar lo mejor! 🏆`)
        .addFields(
          { name: '📅 Fechas',  value: `**Inicio:** ${comienzo}\n**Fin:** ${termina}` },
          { name: '🏅 Premios', value: premios },
          { name: '📌 Info',    value: 'Cada punto que aporten al clan contará para este evento!' }
        ).setImage(interaction.guild.iconURL()).setTimestamp();

      const rCh = await client.channels.fetch(process.env.RANKING_CHANNEL_ID);
      if (rCh) await rCh.send({ embeds: [embed] });

      await postEventRankingMessage();
      await interaction.editReply({ content: `✅ Evento **${nombre}** iniciado! Anuncio y ranking en <#${process.env.RANKING_CHANNEL_ID}>.` });
    } catch (e) { console.error(e); await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }
}


module.exports = { handleModals };

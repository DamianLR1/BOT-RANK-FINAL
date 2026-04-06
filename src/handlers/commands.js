const {
  EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder,
  TextInputStyle, MessageFlags, AttachmentBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { syncRecentPoints } = require('../services/sync');
const { postRankingMessage, postEventRankingMessage, setEventRankingMessage } = require('../services/ranking');
const { postSalonDeHonor } = require('../services/salonHonor');
const { generarExcelEvento } = require('../excel/eventoExcel');
const { fetchMessagesBetween, fetchMessagesAfter, extractPointsFromMessage } = require('../utils/messages');
const { fmtNum, formatDate, formatDuration } = require('../utils/format');

async function handleCommands(interaction) {
  const { commandName } = interaction;
  const guildId = interaction.guild.id;

  // ── /ESTADISTICAS ──────────────────────────────────────────
  if (commandName === 'estadisticas') {
    await interaction.deferReply();
    try {
      const [stats, miembros, mvp, prom, totalEv, evActivo] = await Promise.all([
        pool.query('SELECT total_puntos,temporada_nombre FROM clan_stats WHERE guild=$1', [guildId]),
        pool.query('SELECT COUNT(*) FROM puntos WHERE guild=$1', [guildId]),
        pool.query('SELECT usuario,puntos FROM puntos WHERE guild=$1 ORDER BY puntos DESC LIMIT 1', [guildId]),
        pool.query('SELECT AVG(puntos) as p FROM puntos WHERE guild=$1', [guildId]),
        pool.query('SELECT COUNT(*) FROM eventos_historicos WHERE guild=$1', [guildId]),
        pool.query('SELECT nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1', [guildId])
      ]);
      const s = stats.rows[0] || {};
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'ESTADISTICAS DEL CLAN' }).setTitle('📊 Resumen General')
        .setColor('#3498DB').setThumbnail(interaction.guild.iconURL()).setTimestamp()
        .addFields(
          { name: '🏆 Temporada',          value: `\`${s.temporada_nombre||'Sin nombre'}\``, inline: true },
          { name: '👥 Miembros',            value: `\`${miembros.rows[0].count}\``,           inline: true },
          { name: '⚔️ Eventos historicos',  value: `\`${totalEv.rows[0].count}\``,            inline: true },
          { name: '🌟 Total del clan',      value: `\`${fmtNum(s.total_puntos||0)} pts\``,    inline: true },
          { name: '📈 Promedio',            value: `\`${fmtNum(Math.round(prom.rows[0]?.p||0))} pts\``, inline: true },
          { name: '🔥 Evento activo',       value: evActivo.rows[0] ? `\`${evActivo.rows[0].nombre}\`` : '`Ninguno`', inline: true }
        );
      if (mvp.rows[0]) embed.addFields({ name: '👑 MVP general', value: `**${mvp.rows[0].usuario}** — \`${fmtNum(mvp.rows[0].puntos)} pts\`` });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /EVENTO-ESTADO ─────────────────────────────────────────
  if (commandName === 'evento-estado') {
    await interaction.deferReply();
    try {
      const evR = await pool.query(`SELECT id,nombre,inicio FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
      if (!evR.rows.length) return interaction.editReply({ content: '📭 Sin evento activo.' });
      const ev = evR.rows[0];
      const duracion = Date.now() - new Date(ev.inicio).getTime();
      const top = await pool.query(`SELECT usuario,puntos FROM puntos_evento WHERE evento_id=$1 AND guild=$2 ORDER BY puntos DESC LIMIT 5`, [ev.id, guildId]);
      const exclR = await pool.query(`SELECT usuario FROM excluidos_evento WHERE evento_id=$1`, [ev.id]);
      const excluidos = new Set(exclR.rows.map(r => r.usuario));
      const visibles = top.rows.filter(r => !excluidos.has(r.usuario));
      const medallas = ['🥇','🥈','🥉'];
      const lines = visibles.length
        ? visibles.map((r,i) => `${medallas[i]||`**${i+1}.**`} **${r.usuario}** — \`${fmtNum(r.puntos)} pts\``).join('\n')
        : '*Sin puntos aun*';
      const total = top.rows.reduce((a,b) => a+b.puntos, 0);
      const embed = new EmbedBuilder()
        .setTitle(`Evento Activo — ${ev.nombre}`).setColor('#3498DB')
        .addFields(
          { name: '📅 Inicio',          value: formatDate(new Date(ev.inicio)), inline: true },
          { name: '⏱️ Transcurrido',    value: formatDuration(duracion),        inline: true },
          { name: '\u200B',             value: '\u200B' },
          { name: '🏆 Top 5',           value: lines },
          { name: '⚡ Total del clan',  value: `\`${fmtNum(total)} pts\``,       inline: true }
        ).setTimestamp();
      if (excluidos.size) embed.setFooter({ text: `${excluidos.size} usuario(s) excluido(s)` });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /SALON-DE-HONOR ────────────────────────────────────────
  if (commandName === 'salon-de-honor') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const modo = interaction.options.getString('modo') || 'todos';
      await postSalonDeHonor(interaction.guild, modo);
      await interaction.editReply({ content: `✅ Salon de honor publicado en <#${process.env.HISTORICO_CHANNEL_ID}> (modo: ${modo}).` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /CONSULTAR-EVENTO ──────────────────────────────────────
  if (commandName === 'consultar-evento') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const eventos = await pool.query(
        `SELECT id,nombre,fecha_calculo FROM eventos_historicos WHERE guild=$1 ORDER BY fecha_calculo DESC LIMIT 25`,
        [guildId]
      );
      if (!eventos.rows.length) return interaction.editReply({ content: '📭 No hay eventos históricos.' });
      const options = eventos.rows.map(ev => new StringSelectMenuOptionBuilder()
        .setLabel(ev.nombre.slice(0,100))
        .setDescription(`Calculado el ${new Date(ev.fecha_calculo).toLocaleDateString('es')}`)
        .setValue(String(ev.id))
      );
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_consultar_evento')
        .setPlaceholder('Elegí un evento para re-exportar el Excel')
        .addOptions(options);
      await interaction.editReply({ content: '📋 Seleccioná el evento:', components: [new ActionRowBuilder().addComponents(select)] });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /CALCULAR-INICIO ───────────────────────────────────────
  if (commandName === 'calcular-inicio') {
    const startMsgId = interaction.options.getString('message_id');
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      await pool.query('UPDATE clan_stats SET last_processed_message_id=$1 WHERE guild=$2', [startMsgId, guildId]);
      await interaction.editReply({ content: `⏳ ID establecido. Sincronizando desde ${startMsgId}...` });
      await syncRecentPoints(process.env.CHANNEL_ID, guildId);
      await interaction.editReply({ content: `✅ Sincronización completada desde ID ${startMsgId}.` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /REINICIAR-RANK ────────────────────────────────────────
  if (commandName === 'reiniciar-rank') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      await pool.query('TRUNCATE TABLE puntos');
      await pool.query('UPDATE clan_stats SET total_puntos=0');
      console.log(`[RESET] Ranking purgado por ${interaction.user.tag}`);
      await interaction.editReply({ content: '✅ Ranking reiniciado. Usá `/calcular-inicio` para recontar.' });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /EVENTO-TEMPORADA ──────────────────────────────────────
  if (commandName === 'evento-temporada') {
    const modal = new ModalBuilder().setCustomId('evento-temporada-modal').setTitle('Cambiar Nombre de Temporada');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('evento_nombre').setLabel('Nombre de la temporada')
        .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Navidad 2026').setMaxLength(50).setRequired(true)
    ));
    await interaction.showModal(modal);
  }

  // ── /INICIAR-EVENTO ────────────────────────────────────────
  if (commandName === 'iniciar-evento') {
    const existente = await pool.query(`SELECT nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
    if (existente.rows.length)
      return interaction.reply({ content: `❌ Ya hay un evento activo: **${existente.rows[0].nombre}**. Cerralo primero.`, flags: [MessageFlags.Ephemeral] });

    const nombreEvento = interaction.options.getString('nombre');
    const modal = new ModalBuilder()
      .setCustomId(`iniciar-evento-modal::${nombreEvento}`)
      .setTitle(`Evento: ${nombreEvento.slice(0, 40)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('comienzo').setLabel('Fecha de inicio')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Viernes 10 Ene 20:00h').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('termina').setLabel('Fecha de fin')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Domingo 12 Ene 23:59h').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('premios').setLabel('Premios')
          .setStyle(TextInputStyle.Paragraph).setPlaceholder('🥇 1ro: ...\n🥈 2do: ...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('start_id').setLabel('ID de inicio (vacío = desde ahora)')
          .setStyle(TextInputStyle.Short).setPlaceholder('Vacío = empezar desde este momento').setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('end_id').setLabel('ID de fin (vacío = hasta último mensaje)')
          .setStyle(TextInputStyle.Short).setPlaceholder('Vacío = ir hasta el mensaje más reciente').setRequired(false)
      )
    );
    await interaction.showModal(modal);
  }

  // ── /CERRAR-EVENTO ─────────────────────────────────────────
  if (commandName === 'cerrar-evento') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const evR = await pool.query(
        `SELECT id,nombre,start_message_id,inicio,inicio_texto,fin_texto FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`,
        [guildId]
      );
      if (!evR.rows.length) return interaction.editReply({ content: '⚠️ Sin evento activo.' });
      const evento = evR.rows[0];
      await interaction.editReply({ content: `⏳ Calculando resultados de **${evento.nombre}**...` });

      const pCh = await client.channels.fetch(process.env.CHANNEL_ID);
      const lastMsg = (await pCh.messages.fetch({ limit: 1 })).first();
      const msgs = await fetchMessagesBetween(pCh, evento.start_message_id, lastMsg.id);

      const pointsMap = new Map();
      msgs.forEach(m => {
        const ex = extractPointsFromMessage(m);
        if (ex) pointsMap.set(ex.usuario, (pointsMap.get(ex.usuario)||0)+ex.puntos);
      });

      const totalClan = [...pointsMap.values()].reduce((a,b)=>a+b,0);
      const duracion = Date.now() - new Date(evento.inicio).getTime();

      await pool.query(`UPDATE eventos SET activo=false,fin=NOW() WHERE id=$1`, [evento.id]);
      for (const [u,p] of pointsMap) {
        await pool.query(
          `INSERT INTO puntos_evento (evento_id,guild,usuario,puntos) VALUES ($1,$2,$3,$4)
           ON CONFLICT (evento_id,guild,usuario) DO UPDATE SET puntos=$4`,
          [evento.id, guildId, u, p]
        );
      }

      // Publicar podio
      const evCh = await client.channels.fetch(process.env.EVENTS_CHANNEL_ID);
      if (evCh) await _publicarPodio(interaction.guild, evento, pointsMap, totalClan, duracion, evCh);

      // Borrar ranking del evento pineado
      const evRankMsg = require('../services/ranking').getEventRankingMessage();
      if (evRankMsg) { try { await evRankMsg.delete(); } catch(_){} setEventRankingMessage(null); }

      await interaction.editReply({ content: `✅ Evento **${evento.nombre}** cerrado. Podio en <#${process.env.EVENTS_CHANNEL_ID}>.` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /EXCLUIR-DE-EVENTO ─────────────────────────────────────
  if (commandName === 'excluir-de-evento') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const usuario = interaction.options.getString('usuario').trim();
      const evR = await pool.query(`SELECT id,nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
      if (!evR.rows.length) return interaction.editReply({ content: '⚠️ Sin evento activo.' });
      const ev = evR.rows[0];
      await pool.query(`INSERT INTO excluidos_evento (evento_id,guild,usuario) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [ev.id, guildId, usuario]);
      await postEventRankingMessage();
      await interaction.editReply({ content: `✅ **${usuario}** excluido del rank visible de **${ev.nombre}**.` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /INCLUIR-EN-EVENTO ─────────────────────────────────────
  if (commandName === 'incluir-en-evento') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const usuario = interaction.options.getString('usuario').trim();
      const evR = await pool.query(`SELECT id,nombre FROM eventos WHERE guild=$1 AND activo=true LIMIT 1`, [guildId]);
      if (!evR.rows.length) return interaction.editReply({ content: '⚠️ Sin evento activo.' });
      const ev = evR.rows[0];
      await pool.query(`DELETE FROM excluidos_evento WHERE evento_id=$1 AND guild=$2 AND usuario=$3`, [ev.id, guildId, usuario]);
      await postEventRankingMessage();
      await interaction.editReply({ content: `✅ **${usuario}** vuelve a aparecer en el rank de **${ev.nombre}**.` });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /CALCULAR-EVENTO-HISTORICO ─────────────────────────────
  if (commandName === 'calcular-evento-historico') {
    const nombre = interaction.options.getString('nombre');
    const startId = interaction.options.getString('start_id');
    const endId = interaction.options.getString('end_id');
    const contarEnGlobal = interaction.options.getBoolean('contar_en_global') ?? true;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const yaExiste = await pool.query(
        `SELECT id,nombre FROM eventos_historicos WHERE guild=$1 AND start_message_id=$2 AND end_message_id=$3`,
        [guildId, startId, endId]
      );
      if (yaExiste.rows.length)
        return interaction.editReply({ content: `❌ Ese rango ya fue escaneado como **${yaExiste.rows[0].nombre}**.` });

      await interaction.editReply({ content: `⏳ Escaneando entre \`${startId}\` y \`${endId}\`...` });

      const channel = await client.channels.fetch(process.env.CHANNEL_ID);
      const msgs = await fetchMessagesBetween(channel, startId, endId);
      if (!msgs.length) return interaction.editReply({ content: '⚠️ No se encontraron mensajes.' });

      const pointsMap = new Map();
      msgs.forEach(m => {
        const ex = extractPointsFromMessage(m);
        if (ex) pointsMap.set(ex.usuario, (pointsMap.get(ex.usuario)||0)+ex.puntos);
      });
      if (!pointsMap.size) return interaction.editReply({ content: '⚠️ Sin puntos en ese rango.' });

      const totalPuntos = [...pointsMap.values()].reduce((a,b)=>a+b,0);
      const fechaCalculo = formatDate(new Date());

      const evH = await pool.query(
        `INSERT INTO eventos_historicos (guild,nombre,start_message_id,end_message_id,total_puntos,participantes,fecha_calculo,contar_en_global)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7) RETURNING id`,
        [guildId, nombre, startId, endId, totalPuntos, pointsMap.size, contarEnGlobal]
      );
      const eventoHistId = evH.rows[0].id;

      for (const [u, p] of pointsMap) {
        await pool.query(
          `INSERT INTO puntos_historicos (guild,evento_id,usuario,puntos) VALUES ($1,$2,$3,$4)
           ON CONFLICT (guild,evento_id,usuario) DO UPDATE SET puntos=$4`,
          [guildId, eventoHistId, u, p]
        );
        if (contarEnGlobal) {
          await pool.query(
            `INSERT INTO historico_global (guild,usuario,puntos) VALUES ($1,$2,$3)
             ON CONFLICT (guild,usuario) DO UPDATE SET puntos=historico_global.puntos+$3`,
            [guildId, u, p]
          );
        }
      }

      await interaction.editReply({ content: `✅ ${pointsMap.size} usuarios. Generando Excel...` });
      const usuarios = [...pointsMap.entries()].sort((a,b)=>b[1]-a[1]).map(([usuario,puntos]) => ({ usuario, puntos }));
      const excelBuffer = await generarExcelEvento({ nombre, startId, endId, usuarios, totalPuntos, fechaCalculo });

      const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
      if (logsChannel) {
        const attachment = new AttachmentBuilder(excelBuffer, { name: `${nombre.replace(/\s+/g,'_')}.xlsx` });
        const embed = new EmbedBuilder()
          .setTitle(`📊 Evento registrado: ${nombre}`).setColor('#D4AF37')
          .addFields(
            { name: 'MVP',              value: usuarios[0].usuario,                              inline: true },
            { name: 'Total clan',       value: fmtNum(totalPuntos)+' pts',                      inline: true },
            { name: 'Participantes',    value: String(pointsMap.size),                           inline: true },
            { name: 'Promedio',         value: fmtNum(Math.round(totalPuntos/pointsMap.size))+' pts', inline: true },
            { name: 'Cuenta en global', value: contarEnGlobal ? '✅ Si' : '❌ No',               inline: true },
            { name: 'Calculado',        value: fechaCalculo,                                    inline: true }
          ).setTimestamp();
        await logsChannel.send({ embeds: [embed], files: [attachment] });
      }

      await interaction.editReply({
        content: `✅ **${nombre}** registrado.\n- ${pointsMap.size} participantes\n- ${fmtNum(totalPuntos)} pts\n- Excel en <#${process.env.LOGS_CHANNEL_ID}>\n- Global: ${contarEnGlobal ? 'Sí' : 'No'}`
      });
    } catch (e) { console.error(e); await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /BORRAR-EVENTO ─────────────────────────────────────────
  if (commandName === 'borrar-evento') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    try {
      const eventos = await pool.query(
        `SELECT id,nombre,contar_en_global,participantes,total_puntos FROM eventos_historicos WHERE guild=$1 ORDER BY fecha_calculo DESC LIMIT 25`,
        [guildId]
      );
      if (!eventos.rows.length) return interaction.editReply({ content: '📭 No hay eventos históricos.' });
      const options = eventos.rows.map(ev => new StringSelectMenuOptionBuilder()
        .setLabel(ev.nombre.slice(0,100))
        .setDescription(`${ev.participantes} participantes · ${fmtNum(ev.total_puntos)} pts`)
        .setValue(String(ev.id))
      );
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_borrar_evento')
        .setPlaceholder('Seleccioná el evento a borrar')
        .addOptions(options);
      await interaction.editReply({ content: '⚠️ Seleccioná el evento a borrar:', components: [new ActionRowBuilder().addComponents(select)] });
    } catch (e) { await interaction.editReply({ content: `❌ Error: ${e.message}` }); }
  }

  // ── /RANKCLAN ──────────────────────────────────────────────
  if (commandName === 'rankclan') {
    await interaction.deferReply();
    let page = 0;
    const pageSize = 10;
    const total = parseInt((await pool.query('SELECT COUNT(*) FROM puntos WHERE guild=$1', [guildId])).rows[0].count);
    const totalPages = Math.ceil(total/pageSize)||1;
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const show = async (p) => {
      const r = await pool.query('SELECT usuario,puntos FROM puntos WHERE guild=$1 ORDER BY puntos DESC LIMIT $2 OFFSET $3', [guildId, pageSize, p*pageSize]);
      const lines = r.rows.map((row,i) => `${p*pageSize+i+1}. **${row.usuario}** — ${fmtNum(row.puntos)} pts`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_page_cmd').setLabel('←').setStyle(ButtonStyle.Primary).setDisabled(p===0),
        new ButtonBuilder().setCustomId('next_page_cmd').setLabel('→').setStyle(ButtonStyle.Primary).setDisabled(p>=totalPages-1)
      );
      await interaction.editReply({ content: `🏆 **Ranking (Pág ${p+1}/${totalPages}):**\n\n${lines.join('\n')||'Vacío'}`, components: [row] });
    };
    await show(page);
    const c = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id===interaction.user.id && ['prev_page_cmd','next_page_cmd'].includes(i.customId),
      time: 60000
    });
    c.on('collect', async i => { if(i.customId==='prev_page_cmd') page--; else page++; await i.deferUpdate(); await show(page); });
    c.on('end', () => interaction.editReply({ components: [] }).catch(()=>{}));
  }
}

// ── Helper interno: publicar podio ─────────────────────────
async function _publicarPodio(guild, evento, pointsMap, totalClan, duracionMs, channel) {
  if (!pointsMap.size) { await channel.send({ content: '⚠️ Sin puntos en este evento.' }); return; }
  const sorted = [...pointsMap.entries()].sort((a,b)=>b[1]-a[1]);
  const top = sorted.slice(0,10), mvp = top[0];
  const medallas = ['🥇','🥈','🥉'];
  const lines = top.map(([u,p],i) => `${medallas[i]||`**${i+1}.**`} **${u}** — \`${fmtNum(p)} pts\``).join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`EVENTO FINALIZADO — ${evento.nombre}`).setColor('#E74C3C')
    .setDescription('El evento ha concluido. Resultados finales:')
    .addFields(
      { name: '🌟 MVP del evento', value: `**${mvp[0]}** — \`${fmtNum(mvp[1])} pts\`` },
      { name: '\u200B', value: '\u200B' },
      { name: '🗓️ Periodo', value: `**Inicio:** ${evento.inicio_texto||'-'}\n**Fin:** ${evento.fin_texto||'-'}` },
      { name: '\u200B', value: '\u200B' },
      { name: '🏆 Podio Final', value: lines },
      { name: '\u200B', value: '\u200B' },
      { name: '⚡ Total del clan', value: `\`${fmtNum(totalClan)} pts\``, inline: true },
      { name: '👥 Participantes',  value: `\`${pointsMap.size}\``,        inline: true },
      { name: '⏱️ Duracion',       value: formatDuration(duracionMs),     inline: true }
    ).setImage(guild.iconURL()).setTimestamp().setFooter({ text: 'Gracias a todos por participar' });
  await channel.send({ content: '@everyone', embeds: [embed] });
}

module.exports = { handleCommands };

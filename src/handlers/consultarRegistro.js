const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags
} = require('discord.js');
const { pool } = require('../db/pool');
const { buildEmbedDia } = require('../services/registroDiario');
const { fmtNum } = require('../utils/format');

// ==========================================
// COMANDO /consultar-registro
// ==========================================

async function handleConsultarRegistro(interaction) {
  const guildId = interaction.guild.id;
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    // Obtener todos los meses disponibles
    const meses = await pool.query(
      `SELECT mes_key, mes_texto, total_puntos, dias_activos, mvp_usuario, mvp_puntos
       FROM registros_mensuales WHERE guild=$1 ORDER BY mes_key DESC LIMIT 25`,
      [guildId]
    );

    // Obtener el mes actual (días sueltos aún no cerrados en mes)
    const diasSueltos = await pool.query(
      `SELECT DISTINCT mes_key, mes_texto FROM registros_diarios
       WHERE guild=$1 AND mes_key NOT IN (SELECT mes_key FROM registros_mensuales WHERE guild=$1)
       ORDER BY mes_key DESC LIMIT 5`,
      [guildId]
    );

    if (!meses.rows.length && !diasSueltos.rows.length) {
      return interaction.editReply({ content: '📭 No hay registros archivados aún.' });
    }

    // Construir opciones del select
    const options = [];

    // Primero los meses con días sueltos (mes en curso)
    for (const d of diasSueltos.rows) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`📅 ${d.mes_texto} (en curso)`)
          .setDescription('Días archivados del mes actual')
          .setValue(`dias_${d.mes_key}`)
          .setEmoji('📅')
      );
    }

    // Luego los meses cerrados
    for (const m of meses.rows) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(m.mes_texto)
          .setDescription(`${m.dias_activos} días · ${fmtNum(m.total_puntos)} pts · MVP: ${m.mvp_usuario}`)
          .setValue(`mes_${m.mes_key}`)
          .setEmoji('🗂️')
      );
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('select_registro_mes')
      .setPlaceholder('Elegí un mes para ver sus registros')
      .addOptions(options);

    await interaction.editReply({
      content: '📋 **Consultar Registros**\nSeleccioná el mes que querés ver:',
      components: [new ActionRowBuilder().addComponents(select)]
    });

  } catch (err) {
    console.error('[CONSULTAR-REGISTRO]', err);
    await interaction.editReply({ content: `❌ Error: ${err.message}` });
  }
}

// ==========================================
// SELECT: elegir mes → mostrar días
// ==========================================

async function handleSelectRegistroMes(interaction) {
  await interaction.deferUpdate();
  const guildId = interaction.guild.id;
  const value = interaction.values[0]; // "mes_2025-10" o "dias_2025-11"
  const mesKey = value.replace(/^(mes_|dias_)/, '');
  const esMesCerrado = value.startsWith('mes_');

  try {
    // Si es mes cerrado, mostrar resumen del mes primero
    if (esMesCerrado) {
      const mesR = await pool.query(
        `SELECT * FROM registros_mensuales WHERE guild=$1 AND mes_key=$2`,
        [guildId, mesKey]
      );
      if (mesR.rows.length) {
        const mes = mesR.rows[0];
        const embedMes = new EmbedBuilder()
          .setTitle(`🗂️ ${mes.mes_texto}`)
          .setColor('#D4AF37')
          .addFields(
            { name: '👑 MVP del mes',    value: `**${mes.mvp_usuario}** — \`${fmtNum(mes.mvp_puntos)} pts\``, inline: false },
            { name: '⚡ Total del mes',  value: `\`${fmtNum(mes.total_puntos)} pts\``, inline: true },
            { name: '📅 Días activos',   value: `\`${mes.dias_activos}\``,             inline: true }
          )
          .setFooter({ text: 'Usá los botones de abajo para ver cada día' });

        await interaction.editReply({ content: '', embeds: [embedMes], components: [] });
        await new Promise(r => setTimeout(r, 800));
      }
    }

    // Cargar días del mes
    const dias = await pool.query(
      `SELECT * FROM registros_diarios WHERE guild=$1 AND mes_key=$2 ORDER BY fecha DESC`,
      [guildId, mesKey]
    );

    if (!dias.rows.length) {
      return interaction.followUp({ content: '📭 No hay días archivados en este mes.', flags: [MessageFlags.Ephemeral] });
    }

    let page = 0;
    const totalPages = dias.rows.length;

    const buildComponents = (p) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reg_prev_${mesKey}_${p}`)
          .setLabel('← Día anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`reg_next_${mesKey}_${p}`)
          .setLabel('Día siguiente →')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === 0),
        new ButtonBuilder()
          .setCustomId('reg_volver')
          .setLabel('↩ Volver a meses')
          .setStyle(ButtonStyle.Primary)
      );
      return [row];
    };

    const registro = dias.rows[page];
    registro.top_usuarios = typeof registro.top_usuarios === 'string'
      ? JSON.parse(registro.top_usuarios)
      : registro.top_usuarios;

    const embed = buildEmbedDia(registro);
    embed.setFooter({ text: `Día ${page + 1} de ${totalPages} · ${registro.fecha_texto}` });

    const msg = await interaction.followUp({
      embeds: [embed],
      components: buildComponents(page),
      flags: [MessageFlags.Ephemeral]
    });

    // Colector de botones para navegar días
    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async (btn) => {
      await btn.deferUpdate();

      if (btn.customId === 'reg_volver') {
        collector.stop();
        return handleConsultarRegistro(btn);
      }

      if (btn.customId.startsWith('reg_prev_')) page++;
      if (btn.customId.startsWith('reg_next_')) page--;

      page = Math.max(0, Math.min(page, totalPages - 1));

      const reg = dias.rows[page];
      reg.top_usuarios = typeof reg.top_usuarios === 'string'
        ? JSON.parse(reg.top_usuarios)
        : reg.top_usuarios;

      const newEmbed = buildEmbedDia(reg);
      newEmbed.setFooter({ text: `Día ${page + 1} de ${totalPages} · ${reg.fecha_texto}` });

      await btn.editReply({ embeds: [newEmbed], components: buildComponents(page) });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });

  } catch (err) {
    console.error('[SELECT-REGISTRO-MES]', err);
    await interaction.followUp({ content: `❌ Error: ${err.message}`, flags: [MessageFlags.Ephemeral] });
  }
}

module.exports = { handleConsultarRegistro, handleSelectRegistroMes };

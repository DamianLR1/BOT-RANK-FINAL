const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { pool } = require('../db/pool');
const { generarExcelEvento } = require('../excel/eventoExcel');
const { fmtNum, formatDate } = require('../utils/format');
const { handleSelectRegistroMes } = require('./consultarRegistro');

async function handleSelects(interaction) {
  const { customId } = interaction;
  const guildId = interaction.guild.id;

  // ── Navegar registros por mes ──────────────────────────────
  if (customId === 'select_registro_mes') {
    return handleSelectRegistroMes(interaction);
  }

  // ── Re-exportar Excel de evento histórico ─────────────────
  if (customId === 'select_consultar_evento') {
    await interaction.deferUpdate();
    try {
      const eventoId = parseInt(interaction.values[0]);
      const evR = await pool.query(`SELECT * FROM eventos_historicos WHERE id=$1 AND guild=$2`, [eventoId, guildId]);
      if (!evR.rows.length) return interaction.followUp({ content: '❌ Evento no encontrado.', flags: [MessageFlags.Ephemeral] });
      const ev = evR.rows[0];

      const ptsR = await pool.query(
        `SELECT usuario,puntos FROM puntos_historicos WHERE evento_id=$1 AND guild=$2 ORDER BY puntos DESC`,
        [eventoId, guildId]
      );
      const usuarios = ptsR.rows.map(r => ({ usuario: r.usuario, puntos: Number(r.puntos) }));
      const totalPuntos = usuarios.reduce((a,b)=>a+b.puntos, 0);

      const excelBuffer = await generarExcelEvento({
        nombre: ev.nombre,
        startId: ev.start_message_id,
        endId: ev.end_message_id,
        usuarios,
        totalPuntos,
        fechaCalculo: formatDate(new Date(ev.fecha_calculo))
      });

      const attachment = new AttachmentBuilder(excelBuffer, { name: `${ev.nombre.replace(/\s+/g,'_')}.xlsx` });
      await interaction.followUp({
        content: `📊 Excel de **${ev.nombre}** (re-exportado desde DB):`,
        files: [attachment],
        flags: [MessageFlags.Ephemeral]
      });
    } catch (e) { await interaction.followUp({ content: `❌ Error: ${e.message}`, flags: [MessageFlags.Ephemeral] }); }
  }

  // ── Borrar evento histórico ────────────────────────────────
  if (customId === 'select_borrar_evento') {
    await interaction.deferUpdate();
    try {
      const eventoId = parseInt(interaction.values[0]);
      const evR = await pool.query(`SELECT * FROM eventos_historicos WHERE id=$1 AND guild=$2`, [eventoId, guildId]);
      if (!evR.rows.length) return interaction.followUp({ content: '❌ Evento no encontrado.', flags: [MessageFlags.Ephemeral] });
      const ev = evR.rows[0];

      // Si contaba en global, restar los puntos
      if (ev.contar_en_global) {
        const ptsR = await pool.query(
          `SELECT usuario,puntos FROM puntos_historicos WHERE evento_id=$1 AND guild=$2`,
          [eventoId, guildId]
        );
        for (const row of ptsR.rows) {
          await pool.query(
            `UPDATE historico_global SET puntos=GREATEST(0,puntos-$1) WHERE guild=$2 AND usuario=$3`,
            [row.puntos, guildId, row.usuario]
          );
        }
      }

      await pool.query(`DELETE FROM puntos_historicos WHERE evento_id=$1`, [eventoId]);
      await pool.query(`DELETE FROM eventos_historicos WHERE id=$1`, [eventoId]);

      console.log(`[BORRAR-EVENTO] "${ev.nombre}" borrado por ${interaction.user.tag}`);
      await interaction.followUp({
        content: `✅ Evento **${ev.nombre}** borrado${ev.contar_en_global ? ' y sus puntos removidos del global' : ''}.`,
        flags: [MessageFlags.Ephemeral]
      });
    } catch (e) { await interaction.followUp({ content: `❌ Error: ${e.message}`, flags: [MessageFlags.Ephemeral] }); }
  }
}

module.exports = { handleSelects };

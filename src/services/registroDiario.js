const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { pool } = require('../db/pool');
const { client } = require('../client');
const { fmtNum } = require('../utils/format');

// ==========================================
// HELPERS
// ==========================================

function nombreMes(fecha) {
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'
  }).format(fecha);
}

function nombreDia(fecha) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'
  }).format(fecha);
}

function esFindeMes(fecha) {
  const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
  const hoy = new Date(fecha.toLocaleString('en-US', { timeZone: tz }));
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  return manana.getDate() === 1;
}

// ==========================================
// CONSTRUIR EMBED DE UN DÍA
// ==========================================

function buildEmbedDia(registro) {
  const medallas = ['🥇', '🥈', '🥉'];
  const rows = registro.top_usuarios || [];

  const lines = rows.length
    ? rows.map((r, i) => `${medallas[i] || `**${i + 1}.**`} **${r.usuario}** — \`${fmtNum(r.puntos)} pts\``).join('\n')
    : '*Sin actividad*';

  return new EmbedBuilder()
    .setTitle(`📋 Registro ${registro.fecha_texto}`)
    .setColor('#F1C40F')
    .addFields(
      { name: '🌟 MVP del día',      value: rows[0] ? `**${rows[0].usuario}** — \`${fmtNum(rows[0].puntos)} pts\`` : '*Sin datos*' },
      { name: '🏆 Top aportadores',  value: lines },
      { name: '⚡ Total del clan',   value: `\`${fmtNum(registro.total_puntos)} pts\``, inline: true },
      { name: '👥 Participantes',    value: `\`${registro.participantes}\``,            inline: true }
    )
    .setTimestamp(new Date(registro.fecha))
    .setFooter({ text: `Registro archivado · ${registro.fecha_texto}` });
}

// ==========================================
// ARCHIVAR REGISTRO DEL DÍA ANTERIOR
// ==========================================

async function archivarRegistroDiario(guildId) {
  try {
    const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = ayer.toISOString().split('T')[0];

    // Obtener puntos del día anterior
    const result = await pool.query(
      `SELECT usuario, puntos FROM puntos_diarios WHERE guild=$1 AND fecha=$2 ORDER BY puntos DESC LIMIT 10`,
      [guildId, fechaAyer]
    );

    if (!result.rows.length) {
      console.log(`[REGISTRO] Sin actividad para ${fechaAyer}, no se archiva.`);
      return;
    }

    const totalPuntos = result.rows.reduce((a, b) => a + b.puntos, 0);
    const fechaTexto = `Registro ${nombreDia(ayer)}`;
    const mes = new Date(ayer.toLocaleString('en-US', { timeZone: tz }));
    const mesTexto = `Registro ${nombreMes(ayer)}`;
    const mesKey = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;

    // Verificar que no exista ya ese registro
    const existe = await pool.query(
      `SELECT id FROM registros_diarios WHERE guild=$1 AND fecha=$2`,
      [guildId, fechaAyer]
    );
    if (existe.rows.length) {
      console.log(`[REGISTRO] ${fechaTexto} ya estaba archivado.`);
      return;
    }

    // Guardar en DB
    await pool.query(
      `INSERT INTO registros_diarios (guild, fecha, fecha_texto, mes_key, mes_texto, top_usuarios, total_puntos, participantes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        guildId, fechaAyer, fechaTexto, mesKey, mesTexto,
        JSON.stringify(result.rows),
        totalPuntos,
        result.rows.length
      ]
    );

    console.log(`[REGISTRO] ✅ ${fechaTexto} archivado.`);
  } catch (err) {
    console.error('[REGISTRO] ❌ Error archivando registro diario:', err.message);
  }
}

// ==========================================
// ARCHIVAR MES COMPLETO (fin de mes)
// ==========================================

async function archivarMesCompleto(guildId) {
  try {
    const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
    const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

    // El mes que termina es el mes anterior al actual
    const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesKey = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, '0')}`;
    const mesTexto = `Registro ${nombreMes(mesPasado)}`;

    // Verificar si ya está archivado
    const existe = await pool.query(
      `SELECT id FROM registros_mensuales WHERE guild=$1 AND mes_key=$2`,
      [guildId, mesKey]
    );
    if (existe.rows.length) {
      console.log(`[REGISTRO] Mes ${mesKey} ya archivado.`);
      return;
    }

    // Obtener todos los días del mes
    const dias = await pool.query(
      `SELECT * FROM registros_diarios WHERE guild=$1 AND mes_key=$2 ORDER BY fecha ASC`,
      [guildId, mesKey]
    );

    if (!dias.rows.length) {
      console.log(`[REGISTRO] Sin registros para el mes ${mesKey}.`);
      return;
    }

    const totalMes = dias.rows.reduce((a, b) => a + Number(b.total_puntos), 0);
    const diasCount = dias.rows.length;

    // Calcular MVP del mes (usuario con más puntos sumados en el mes)
    const mvpMap = new Map();
    dias.rows.forEach(dia => {
      const top = dia.top_usuarios || [];
      top.forEach(u => mvpMap.set(u.usuario, (mvpMap.get(u.usuario) || 0) + u.puntos));
    });
    const mvpMes = [...mvpMap.entries()].sort((a, b) => b[1] - a[1])[0];

    await pool.query(
      `INSERT INTO registros_mensuales (guild, mes_key, mes_texto, total_puntos, dias_activos, mvp_usuario, mvp_puntos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [guildId, mesKey, mesTexto, totalMes, diasCount, mvpMes?.[0] || '-', mvpMes?.[1] || 0]
    );

    console.log(`[REGISTRO] ✅ Mes ${mesKey} archivado con ${diasCount} días.`);
  } catch (err) {
    console.error('[REGISTRO] ❌ Error archivando mes:', err.message);
  }
}

// ==========================================
// PUBLICAR REPORTE DIARIO Y GESTIONAR CANAL
// ==========================================

let mensajeReporteActual = null;

async function publicarYRotarReporte(guildId) {
  try {
    const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = ayer.toISOString().split('T')[0];

    const channel = await client.channels.fetch(process.env.RANKING_CHANNEL_ID);
    if (!channel) return;

    // 1. Archivar el día anterior primero
    await archivarRegistroDiario(guildId);

    // 2. Si es fin de mes, archivar el mes
    if (esFindeMes(ayer)) {
      await archivarMesCompleto(guildId);
      console.log('[REGISTRO] 📅 Fin de mes detectado, mes archivado.');
    }

    // 3. Obtener datos del día anterior para el embed
    const result = await pool.query(
      `SELECT usuario, puntos FROM puntos_diarios WHERE guild=$1 AND fecha=$2 ORDER BY puntos DESC LIMIT 10`,
      [guildId, fechaAyer]
    );

    if (!result.rows.length) return;

    const totalDia = result.rows.reduce((a, b) => a + b.puntos, 0);
    const mvp = result.rows[0];
    const medallas = ['🥇', '🥈', '🥉'];
    const lines = result.rows.map((row, i) =>
      `${medallas[i] || `**${i + 1}.**`} **${row.usuario}** — \`${fmtNum(row.puntos)} pts\``
    ).join('\n');

    const fechaFmt = new Intl.DateTimeFormat('es', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: tz
    }).format(ayer);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Reporte Diario — ${fechaFmt}`)
      .setColor('#F1C40F')
      .addFields(
        { name: '🌟 MVP del día',     value: `**${mvp.usuario}** — \`${fmtNum(mvp.puntos)} pts\`` },
        { name: '🏆 Top aportadores', value: lines },
        { name: '⚡ Total del clan',  value: `\`${fmtNum(totalDia)} pts\``, inline: true },
        { name: '👥 Participantes',   value: `\`${result.rows.length}\``,   inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Reporte del día · Se archivará mañana' });

    // 4. Buscar y borrar el mensaje anterior del bot en el canal
    if (!mensajeReporteActual) {
      // Buscar en los últimos mensajes del canal
      const recent = await channel.messages.fetch({ limit: 20 });
      mensajeReporteActual = recent.find(m =>
        m.author.id === client.user.id &&
        m.embeds[0]?.title?.startsWith('📊 Reporte Diario')
      );
    }

    if (mensajeReporteActual) {
      try { await mensajeReporteActual.delete(); } catch (_) {}
      mensajeReporteActual = null;
    }

    // 5. Publicar el nuevo reporte
    mensajeReporteActual = await channel.send({ embeds: [embed] });
    console.log(`[REGISTRO] 📊 Reporte del ${fechaFmt} publicado.`);

  } catch (err) {
    console.error('[REGISTRO] ❌ Error en publicarYRotarReporte:', err.message);
  }
}

// ==========================================
// PROGRAMAR ROTACIÓN DIARIA
// ==========================================

function programarRotacionDiaria() {
  const tz = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(0, 1, 0, 0); // 00:01 del día siguiente

  const ms = manana - ahora;
  console.log(`[REGISTRO] ⏰ Próxima rotación en ${Math.round(ms / 60000)} minutos`);

  setTimeout(async () => {
    for (const [guildId] of client.guilds.cache) {
      await publicarYRotarReporte(guildId);
    }
    // Repetir cada 24 horas
    setInterval(async () => {
      for (const [guildId] of client.guilds.cache) {
        await publicarYRotarReporte(guildId);
      }
    }, 24 * 60 * 60 * 1000);
  }, ms);
}

module.exports = {
  programarRotacionDiaria,
  publicarYRotarReporte,
  archivarRegistroDiario,
  archivarMesCompleto,
  buildEmbedDia
};

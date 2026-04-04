const { REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const commands = [
  // ── Públicos ───────────────────────────────────────────────
  new SlashCommandBuilder().setName('rankclan').setDescription('Ranking general del clan').toJSON(),
  new SlashCommandBuilder().setName('estadisticas').setDescription('Estadísticas generales del clan').toJSON(),
  new SlashCommandBuilder().setName('evento-estado').setDescription('Ranking parcial del evento activo').toJSON(),
  new SlashCommandBuilder().setName('salon-de-honor')
    .setDescription('Top global histórico del clan')
    .addStringOption(o => o.setName('modo').setDescription('Qué eventos contar').setRequired(false)
      .addChoices({ name: 'Todos los eventos', value: 'todos' }, { name: 'Solo eventos marcados', value: 'marcados' }))
    .toJSON(),
  new SlashCommandBuilder().setName('consultar-evento')
    .setDescription('Consultar y re-exportar un evento histórico guardado')
    .toJSON(),
  new SlashCommandBuilder().setName('consultar-registro')
    .setDescription('[Admin] Ver los registros diarios y mensuales archivados')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),

  // ── Admin - Rank general ───────────────────────────────────
  new SlashCommandBuilder().setName('calcular-inicio')
    .setDescription('[Admin] Inicia el rastreo desde un ID de mensaje')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o => o.setName('message_id').setDescription('ID del mensaje de inicio').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder().setName('reiniciar-rank')
    .setDescription('[Admin] ⚠️ Borra todos los puntos del rank general')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),
  new SlashCommandBuilder().setName('evento-temporada')
    .setDescription('[Admin] Cambia el nombre de la temporada')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),

  // ── Admin - Evento activo ──────────────────────────────────
  new SlashCommandBuilder().setName('iniciar-evento')
    .setDescription('[Admin] Inicia un nuevo evento y comienza el rastreo')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),
  new SlashCommandBuilder().setName('cerrar-evento')
    .setDescription('[Admin] Cierra el evento activo y publica el podio')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),
  new SlashCommandBuilder().setName('excluir-de-evento')
    .setDescription('[Admin] Excluye un usuario del rank visible del evento activo')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o => o.setName('usuario').setDescription('Nombre exacto del usuario').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder().setName('incluir-en-evento')
    .setDescription('[Admin] Vuelve a incluir un usuario excluido del evento activo')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o => o.setName('usuario').setDescription('Nombre exacto del usuario').setRequired(true))
    .toJSON(),

  // ── Admin - Histórico ──────────────────────────────────────
  new SlashCommandBuilder().setName('calcular-evento-historico')
    .setDescription('[Admin] Calcula un evento pasado entre dos IDs y lo guarda en el histórico')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o => o.setName('nombre').setDescription('Nombre del evento (ej: Navidad 2025)').setRequired(true))
    .addStringOption(o => o.setName('start_id').setDescription('ID del primer mensaje del evento').setRequired(true))
    .addStringOption(o => o.setName('end_id').setDescription('ID del último mensaje del evento').setRequired(true))
    .addBooleanOption(o => o.setName('contar_en_global').setDescription('¿Contar en el salón de honor global?').setRequired(false))
    .toJSON(),
  new SlashCommandBuilder().setName('borrar-evento')
    .setDescription('[Admin] Borra un evento histórico y sus puntos del global')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON(),
];

async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandos registrados');
  } catch (e) { console.error('❌ Error registrando comandos:', e); }
}

module.exports = { commands, registerCommands };

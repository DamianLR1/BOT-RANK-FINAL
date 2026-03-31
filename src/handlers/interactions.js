const { client } = require('../client');
const { handleCommands } = require('./commands');
const { handleButtons } = require('./buttons');
const { handleModals } = require('./modals');
const { handleSelects } = require('./selects');

client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;
  try {
    if (interaction.isChatInputCommand())  await handleCommands(interaction);
    if (interaction.isButton())            await handleButtons(interaction);
    if (interaction.isModalSubmit())       await handleModals(interaction);
    if (interaction.isStringSelectMenu())  await handleSelects(interaction);
  } catch (err) {
    console.error('[InteractionCreate] Error no capturado:', err);
  }
});

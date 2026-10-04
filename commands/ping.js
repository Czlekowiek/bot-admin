const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Sprawdza opóźnienie (ping) bota.'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Mierzę ping...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiPing = interaction.client.ws.ping;

        await interaction.editReply(`Opóźnienie wiadomości: **${latency}ms**\nOpóźnienie API Discorda: **${apiPing}ms**`);
    },
};

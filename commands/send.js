const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder 
} = require('discord.js');
const { sendLog } = require('../utils/logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Wysyła wiadomość lub embed jako bot.')
        .addStringOption(option =>
            option.setName('typ')
                .setDescription('Wybierz co chcesz wysłać')
                .setRequired(true)
                .addChoices(
                    { name: 'Zwykła wiadomość', value: 'wiadomosc' },
                    { name: 'Embed (#FFCE00)', value: 'embed' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Domyślnie tylko dla administracji

    async execute(interaction) {
        const typ = interaction.options.getString('typ');

        const modal = new ModalBuilder()
            .setCustomId(`modal_send_${typ}`)
            .setTitle(typ === 'wiadomosc' ? 'Wysyłanie wiadomości' : 'Wysyłanie Embedu');

        const textInput = new TextInputBuilder()
            .setCustomId('send_content')
            .setLabel(typ === 'wiadomosc' ? 'Treść wiadomości' : 'Treść (opis) embedu')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(textInput));

        return await interaction.showModal(modal);
    },
};

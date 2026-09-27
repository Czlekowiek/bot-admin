const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Wysyła wiadomość lub embed jako bot.')
        .addStringOption(option =>
            option.setName('typ')
                .setDescription('Wybierz co chcesz wysłać')
                .setRequired(true)
                .addChoices(
                    { name: 'Wiadomość', value: 'wiadomosc' },
                    { name: 'Embed', value: 'embed' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const typ = interaction.options.getString('typ');

        const modal = new ModalBuilder()
            .setCustomId(`modal_send_${typ}`)
            .setTitle(typ === 'wiadomosc' ? 'Wysyłanie wiadomości' : 'Wysyłanie Embedu');

        if (typ === 'wiadomosc') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('send_content')
                        .setLabel('Treść wiadomości')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );
        } else {
            // Modal dla Embedu: tylko treść (wiadomość) jest obowiązkowa, reszta opcjonalna
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embed_title')
                        .setLabel('Tytuł (opcjonalnie)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embed_content')
                        .setLabel('Wiadomość / Opis (obowiązkowe)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embed_footer')
                        .setLabel('Footer (opcjonalnie - dopisze się autor)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embed_thumbnail')
                        .setLabel('Thumbnail URL (opcjonalnie)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embed_image')
                        .setLabel('Image URL (opcjonalnie)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                )
            );
        }

        return await interaction.showModal(modal);
    },
};

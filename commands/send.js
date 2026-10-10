const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Wysyła wiadomość lub embed jako bot.')
        .addStringOption(option =>
            option.setName('typ')
                .setDescription('Wybierz typ wiadomości do wysłania.')
                .setRequired(true)
                .addChoices(
                    { name: 'Wiadomość', value: 'wiadomosc' },
                    { name: 'Embed', value: 'embed' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const typ = interaction.options.getString('typ');

        const uniqueId = `${interaction.user.id}_${Date.now()}`;
        const modalCustomId = `modal_send_${typ}_${uniqueId}`;

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
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
                        .setLabel('Footer (opcjonalnie)')
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

        await interaction.showModal(modal);

        const filter = (i) => i.customId === modalCustomId && i.user.id === interaction.user.id;
        
        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 300_000 });

            if (typ === 'wiadomosc') {
                const content = modalInteraction.fields.getTextInputValue('send_content');
                
                await interaction.channel.send({ content: content });
                await modalInteraction.reply({ 
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie wysłano wiadomość!', 
                    ephemeral: true 
                });
                
            } else if (typ === 'embed') {
                const title = modalInteraction.fields.getTextInputValue('embed_title');
                const content = modalInteraction.fields.getTextInputValue('embed_content');
                const footerText = modalInteraction.fields.getTextInputValue('embed_footer');
                const thumbnail = modalInteraction.fields.getTextInputValue('embed_thumbnail');
                const image = modalInteraction.fields.getTextInputValue('embed_image');

                const embed = new EmbedBuilder()
                    .setDescription(content)
                    .setColor(16764416);

                if (title) embed.setTitle(title);
                
                if (footerText) {
                    embed.setFooter({ text: `${footerText} • Stworzone przez ${interaction.user.tag}` });
                } else {
                    embed.setFooter({ text: `Stworzone przez ${interaction.user.tag}` });
                }

                if (thumbnail && thumbnail.startsWith('http')) embed.setThumbnail(thumbnail);
                if (image && image.startsWith('http')) embed.setImage(image);

                await interaction.channel.send({ embeds: [embed] });
                await modalInteraction.reply({ 
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie wysłano Embed!', 
                    ephemeral: true 
                });
            }
        } catch (err) {
            // Ignorujemy błędy timeoutu / zamknięcia modala
        }
    },
};
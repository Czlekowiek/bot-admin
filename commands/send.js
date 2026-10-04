const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder // DODANE: Wymagane do tworzenia Embedu
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
            // Modal dla Embedu
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

        // 1. Pokazujemy modal użytkownikowi
        await interaction.showModal(modal);

        // 2. Czekamy na odpowiedź z modala (limit czasu: 5 minut)
        const filter = (i) => i.customId === `modal_send_${typ}` && i.user.id === interaction.user.id;
        
        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 300_000 });

            // 3. Obsługa w zależności od tego, co użytkownik wybrał
            if (typ === 'wiadomosc') {
                const content = modalInteraction.fields.getTextInputValue('send_content');
                
                await interaction.channel.send({ content: content });
                await modalInteraction.reply({ content: '<a:greentick:1543991524738465853> Pomyślnie wysłano wiadomość!', ephemeral: true });
                
            } else if (typ === 'embed') {
                const title = modalInteraction.fields.getTextInputValue('embed_title');
                const content = modalInteraction.fields.getTextInputValue('embed_content');
                const footerText = modalInteraction.fields.getTextInputValue('embed_footer');
                const thumbnail = modalInteraction.fields.getTextInputValue('embed_thumbnail');
                const image = modalInteraction.fields.getTextInputValue('embed_image');

                const embed = new EmbedBuilder()
                    .setDescription(content)
                    .setColor(16764416); // Możesz ustawić własny kolor

                if (title) embed.setTitle(title);
                
                // Footer z informacją o autorze (jeśli podał tekst do footera to doklejamy, jeśli nie, to sam autor)
                if (footerText) {
                    embed.setFooter({ text: `${footerText} • Stworzone przez ${interaction.user.tag}` });
                } else {
                    embed.setFooter({ text: `Stworzone przez ${interaction.user.tag}` });
                }

                // Bezpieczne ustawianie obrazków (tylko poprawne linki)
                if (thumbnail && thumbnail.startsWith('http')) embed.setThumbnail(thumbnail);
                if (image && image.startsWith('http')) embed.setImage(image);

                await interaction.channel.send({ embeds: [embed] });
                await modalInteraction.reply({ content: '<a:greentick:1543991524738465853> Pomyślnie wysłano Embed!', ephemeral: true });
            }
        } catch (err) {
            // Jeśli użytkownik zamknie modal lub upłynie 5 minut
            console.error('Błąd lub upłynął czas modala komendy send:', err);
        }
    },
};

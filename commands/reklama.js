const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reklama')
        .setDescription('Wysyła reklamę serwera w ładnym embedzie')
        .addStringOption(option =>
            option.setName('nazwa')
                .setDescription('Nazwa reklamowanego serwera')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reklama')
                .setDescription('Treść reklamy serwera')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Link zaproszenia do serwera')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('logo')
                .setDescription('Link do loga serwera - miniatura (opcjonalnie)')
                .setRequired(false)),

    async execute(interaction) {
        const nazwa = interaction.options.getString('nazwa');
        let tresc = interaction.options.getString('reklama');
        let link = interaction.options.getString('link').trim();
        let logo = interaction.options.getString('logo');

        // Czyszczenie linku z ewentualnych nawiasów ostrokątnych (<...>)
        if (link.startsWith('<') && link.endsWith('>')) {
            link = link.slice(1, -1);
        }

        if (logo) {
            logo = logo.trim();
            if (logo.startsWith('<') && logo.endsWith('>')) {
                logo = logo.slice(1, -1);
            }
        }

        // Łączenie nazwy jako nagłówka i treści reklamy w description
        const finalDescription = `# ${nazwa}\n\n${tresc}`;

        // Budowanie embeda w kolorze #FFCE00
        const reklamaEmbed = new EmbedBuilder()
            .setDescription(finalDescription)
            .setColor(0xFFCE00)
            .addFields(
                { name: '🔗 Link do serwera', value: `[Kliknij, aby dołączyć!](${link})`, inline: false }
            )
            .setFooter({ 
                text: `Reklama wysłana przez ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Jeśli podano opcjonalne logo, ustawiamy je jako miniaturę (thumbnail)
        if (logo) {
            reklamaEmbed.setThumbnail(logo);
        }

        return interaction.reply({ embeds: [reklamaEmbed] });
    },
};

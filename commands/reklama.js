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
        .addUserOption(option =>
            option.setName('przedstawiciel')
                .setDescription('Osoba reprezentująca ten serwer (współpraca)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('logo')
                .setDescription('Link do loga serwera - miniatura (opcjonalnie)')
                .setRequired(false)),

    async execute(interaction) {
        const nazwa = interaction.options.getString('nazwa');
        let tresc = interaction.options.getString('reklama');
        let link = interaction.options.getString('link').trim();
        const przedstawiciel = interaction.options.getUser('przedstawiciel');
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

        // Składanie całego opisu: Nazwa -> Treść -> Odstęp -> Link w opisie ze spoilerem przedstawiciela
        const finalDescription = `# ${nazwa}\n\n${tresc}\n\n## ⛓️ Link do serwera\n## [Kliknij, aby dołączyć!](${link})\n||${przedstawiciel}||`;

        // Budowanie embeda w kolorze #FFCE00
        const reklamaEmbed = new EmbedBuilder()
            .setDescription(finalDescription)
            .setColor(0xFFCE00)
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

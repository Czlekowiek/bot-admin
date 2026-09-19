const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLog } = require('../utils/logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reklama')
        .setDescription('Wysyła reklamę serwera w ładnym embedzie')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

        if (link.startsWith('<') && link.endsWith('>')) {
            link = link.slice(1, -1);
        }

        if (logo) {
            logo = logo.trim();
            if (logo.startsWith('<') && logo.endsWith('>')) {
                logo = logo.slice(1, -1);
            }
        }

        const finalDescription = `# ${nazwa}\n\n${tresc}\n\n## ⛓️ Link do serwera: [Kliknij, aby dołączyć!](${link})\n\vert{}\vert{}${przedstawiciel}||`;

        const reklamaEmbed = new EmbedBuilder()
            .setDescription(finalDescription)
            .setColor(0xFFCE00)
            .setFooter({ 
                text: `Reklama wysłana przez ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        if (logo) {
            reklamaEmbed.setThumbnail(logo);
        }

        await sendLog(interaction.client, {
            title: 'Wysłano Reklamę / Współpracę',
            description: `Administrator wysłał nową reklamę serwera.\n\n• **Serwer:** ${nazwa}\n• **Przedstawiciel:** <@${przedstawiciel.id}>\n• **Link:** ${link}`,
            color: 0xf1c40f,
            executor: interaction.user
        });

        return interaction.reply({ embeds: [reklamaEmbed] });
    },
};

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aktywnosc')
        .setDescription('Tworzy wiadomość o aktywność check')
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Opis (opcjonalnie)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const opis = interaction.options.getString('opis') || 'Brak opisu';
        const channelId = '1542122742768210000';

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return interaction.reply({ content: 'Nie znaleziono kanału aktywności', ephemeral: true });
        }

        const now = new Date();
        const formattedTime = now.toLocaleString('pl-PL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        let descriptionText = `# <a:checkmark:1543969158646206475> Aktywność check\n## <a:top1:1548673656761352304> Brak\n## <a:top2:1548673747983011891> Brak\n## <a:top3:1548673801104138322> Brak\n\n## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

        if (opis !== 'Brak opisu') {
            descriptionText += `\n\n### <:arrow:1543977081233342494> Opis: ${opis}`;
        }

        const embed = new EmbedBuilder()
            .setDescription(descriptionText)
            .setColor(16764416)
            .setFooter({ text: `Stworzone przez @czlekowiek • Data: ${formattedTime}` });

        const sentMessage = await channel.send({
            content: '@everyone @here',
            embeds: [embed]
        });

        await sentMessage.react('1543969158646206475');

        // Wysyłanie szczegółowego logu do systemu
        await sendLog(interaction.client, {
            title: 'Utworzono Aktywność Check',
            description: `Administrator utworzył nową wiadomość aktywności.\n\n• **Kanał docelowy:** <#${channelId}>\n• **Opis:** ${opis}\n• **ID Wiadomości:** \`${sentMessage.id}\``,
            color: 0x1abc9c,
            executor: interaction.user
        });

        return interaction.reply({ content: 'Utworzono wiadomość aktywności na kanale https://discord.com/channels/1542121318286233683/1542122742768210000', ephemeral: true });
    }
};

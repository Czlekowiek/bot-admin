const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aktywnosc')
        .setDescription('Tworzy wiadomość aktywności z systemem top 3 reakcji.')
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Opis aktywności (np. dzień aktywności, budowa mapy)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const opis = interaction.options.getString('opis');
        const channelId = '1542122742768210000';

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return interaction.reply({ content: 'Nie znaleziono docelowego kanału aktywności!', ephemeral: true });
        }

        const now = new Date();
        const formattedTime = now.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const embed = new EmbedBuilder()
            .setTitle('<a:checkmark:1543969158646206475> Aktywność check')
            .setDescription(`## <a:top1:1548673656761352304> 1. Brak\n## <a:top2:1548673747983011891> 2. Brak\n## <a:top3:1548673801104138322> 3. Brak\n\n<a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.\n\nOpis: ${opis}`)
            .setColor(16764416)
            .setFooter({
                text: `Stworzone przez @czlekowiek • Aktywność check: ${formattedTime}`
            });

        const sentMessage = await channel.send({
            content: '@everyone @here',
            embeds: [embed]
        });

        // Dodanie animowanej reakcji checkmark (używamy ID emoji)
        await sentMessage.react('1543969158646206475');

        await interaction.reply({ content: `Pomyślnie utworzono wiadomość aktywności na kanale <#${channelId}>!`, ephemeral: true });
    },
};

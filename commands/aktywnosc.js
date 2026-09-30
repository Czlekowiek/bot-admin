const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const TOP1_ROLE_ID = '1554904742335881377';
const EMOJI_ID = '1543969158646206475';

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
        const opis = interaction.options.getString('opis');
        const channelId = '1542122742768210000';
        const guild = interaction.guild;

        // 1. Zdejmowanie roli wszystkim, którzy ją obecnie posiadają
        try {
            await guild.members.fetch();
            const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(TOP1_ROLE_ID));
            for (const [memberId, member] of membersWithRole) {
                await member.roles.remove(TOP1_ROLE_ID).catch(() => {});
            }
        } catch (err) {
            console.error('Błąd podczas usuwania starej roli:', err);
        }

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return interaction.reply({ content: '<a:redtick:1543991522192527450> Nie znaleziono kanału aktywności', ephemeral: true });
        }

        const now = new Date();
        const formattedTime = now.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let descriptionText = `# <a:checkmark:1543969158646206475> Aktywność check\n## <a:top1:1548673656761352304> Brak\n## <a:top2:1548673747983011891> Brak\n## <a:top3:1548673801104138322> Brak\n\n## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

        if (opis) {
            descriptionText += `\n\n<:arrow:1543977081233342494> Opis: ${opis}`;
        }

        const embed = new EmbedBuilder()
            .setDescription(descriptionText)
            .setColor(16764416)
            .setFooter({
                text: `Stworzone przez @czlekowiek • Data: ${formattedTime}`
            });

        const sentMessage = await channel.send({
            content: '@everyone @here',
            embeds: [embed]
        });

        await sentMessage.react(EMOJI_ID);

        // Logowanie użycia komendy aktywności
        try {
            if (interaction.client && typeof interaction.client.sendLog === 'function') {
                await interaction.client.sendLog(`<a:neon_staff:1550909470605844650> Administrator **${interaction.user.tag}** utworzył wiadomość sprawdzającą aktywność na kanale <#${channelId}>.`);
            }
        } catch (e) {}

        return interaction.reply({ content: '<a:greentick:1543991524738465853> Utworzono wiadomość aktywności na kanale https://discord.com/channels/1542121318286233683/1542122742768210000', ephemeral: true });
    },

    // 2. Obsługa nadawania roli pierwszej osobie z Top 1
    setupEvents(client) {
        client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;

            try {
                // Pobieranie danych partials
                if (reaction.partial) await reaction.fetch();
                if (reaction.message.partial) await reaction.message.fetch();

                // Sprawdzanie czy to właściwa emotka i wiadomość
                if (reaction.emoji.id !== EMOJI_ID) return;
                if (!reaction.message.embeds.length) return;
                const embedDesc = reaction.message.embeds[0].description || '';
                if (!embedDesc.includes('Aktywność check')) return;

                const guild = reaction.message.guild;
                if (!guild) return;

                await guild.members.fetch();

                // Jeżeli ktoś na serwerze ma już rolę Top 1, ignorujemy kolejne osoby
                const someoneHasRole = guild.members.cache.some(m => m.roles.cache.has(TOP1_ROLE_ID));
                if (someoneHasRole) return;

                // Pobieramy użytkowników, którzy zareagowali
                const users = await reaction.users.fetch();
                const realUsers = users.filter(u => !u.bot);

                if (realUsers.size === 0) return;

                // Pierwszy użytkownik, który dał reakcję
                const firstUser = realUsers.first();

                if (user.id === firstUser.id) {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member && !member.roles.cache.has(TOP1_ROLE_ID)) {
                        await member.roles.add(TOP1_ROLE_ID);
                    }
                }
            } catch (err) {
                console.error('Błąd w obsłudze reakcji aktywności:', err);
            }
        });
    }
};

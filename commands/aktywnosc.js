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

        // 1. Podczas użycia komendy: sprawdza czy ktoś ma tę rolę i ją zabiera
        try {
            await guild.members.fetch(); // Pobiera członków do pamięci cache
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
            descriptionText += `\n\n### <:arrow:1543977081233342494> **Opis:** ${opis}`;
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

    // 2. Obsługa reakcji – tylko pierwsza osoba, która zareaguje, dostaje rolę (o ile nikt jej jeszcze nie ma)
    setupEvents(client) {
        client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;
            if (reaction.partial) {
                try { await reaction.fetch(); } catch { return; }
            }
            if (reaction.message.partial) {
                try { await reaction.message.fetch(); } catch { return; }
            }

            if (reaction.emoji.id !== EMOJI_ID) return;
            if (!reaction.message.embeds.length) return;
            const embedDesc = reaction.message.embeds[0].description || '';
            if (!embedDesc.includes('Aktywność check')) return;

            const guild = reaction.message.guild;
            if (!guild) return;

            try {
                await guild.members.fetch();

                // Sprawdzamy czy KTOKOLWIEK na serwerze ma już tę rolę.
                // Jeśli tak, ignorujemy kolejne reakcje.
                const someoneHasRole = guild.members.cache.some(member => member.roles.cache.has(TOP1_ROLE_ID));
                if (someoneHasRole) return;

                // Pobieramy użytkowników, którzy zareagowali
                const usersMap = await reaction.users.fetch({ limit: 5 }).catch(() => null);
                if (!usersMap) return;

                const validUsers = [];
                for (const [uId, uObj] of usersMap) {
                    if (!uObj.bot) validUsers.push(uId);
                }

                if (validUsers.length === 0) return;

                // Absolutnie pierwsza osoba, która dała reakcję
                const firstUserId = validUsers[0];

                if (user.id === firstUserId) {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member && !member.roles.cache.has(TOP1_ROLE_ID)) {
                        await member.roles.add(TOP1_ROLE_ID).catch(() => {});
                    }
                }
            } catch (err) {
                console.error('Błąd podczas przydzielania roli Top 1:', err);
            }
        });
    }
};

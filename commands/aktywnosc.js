const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const reactionHistory = new Map();

async function getOrCreateUsersList(reaction) {
    const msgId = reaction.message.id;
    if (!reactionHistory.has(msgId)) {
        const usersMap = await reaction.users.fetch({ limit: 100 });
        const usersList = [];
        for (const [userId, user] of usersMap) {
            if (!user.bot) usersList.push(userId);
        }
        reactionHistory.set(msgId, usersList);
    }
    return reactionHistory.get(msgId);
}

async function updateActivityBoard(message, usersList) {
    if (!message.embeds.length) return;
    const embed = message.embeds[0];
    const opisMatch = embed.description.split(/### <:arrow:1543977081233342494> Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : null;

    const top1 = usersList[0] ? `<@${usersList[0]}>` : 'Brak';
    const top2 = usersList[1] ? `<@${usersList[1]}>` : 'Brak';
    const top3 = usersList[2] ? `<@${usersList[2]}>` : 'Brak';

    let newDescription = `# <a:checkmark:1543969158646206475> Aktywność check\n## <a:top1:1548673656761352304> ${top1}\n## <a:top2:1548673747983011891> ${top2}\n## <a:top3:1548673801104138322> ${top3}\n\n## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;
    if (activityDescription) newDescription += `\n\n### <:arrow:1543977081233342494> Opis: ${activityDescription}`;

    await message.edit({ embeds: [EmbedBuilder.from(embed).setDescription(newDescription)] });
}

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

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return interaction.reply({ content: 'Nie znaleziono kanału aktywności', ephemeral: true });
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
            descriptionText += `\n\n### <:arrow:1543977081233342494> Opis: ${opis}`;
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

        await sentMessage.react('1543969158646206475');

        await interaction.reply({ content: 'Utworzono wiadomość aktywności na kanale https://discord.com/channels/1542121318286233683/1542122742768210000', ephemeral: true });
    },

    setupEvents(client) {
        client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;
            if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
            if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }
            if (reaction.emoji.id !== '1543969158646206475') return;
            const usersList = await getOrCreateUsersList(reaction);
            if (!usersList.includes(user.id)) usersList.push(user.id);
            await updateActivityBoard(reaction.message, usersList);
        });

        client.on('messageReactionRemove', async (reaction, user) => {
            if (user.bot) return;
            if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
            if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }
            if (reaction.emoji.id !== '1543969158646206475') return;
            const usersList = await getOrCreateUsersList(reaction);
            const index = usersList.indexOf(user.id);
            if (index > -1) usersList.splice(index, 1);
            await updateActivityBoard(reaction.message, usersList);
        });
    }
};

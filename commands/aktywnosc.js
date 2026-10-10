const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getDb } = require('../utils/database');

async function getActivityData(messageId) {
    const db = getDb();
    if (!db) {
        console.warn('⚠️ [Aktywność] MongoDB nie jest jeszcze połączone!');
        return null;
    }
    return await db.collection('activity_checks').findOne({ messageId });
}

async function saveActivityData(messageId, usersList, locked) {
    const db = getDb();
    if (!db) {
        console.warn('⚠️ [Aktywność] MongoDB nie jest połączone - nie można zapisać danych!');
        return;
    }
    await db.collection('activity_checks').updateOne(
        { messageId },
        { $set: { usersList, locked, updatedAt: new Date() } },
        { upsert: true }
    );
}

async function getOrInitUsersList(reaction) {
    const msgId = reaction.message.id;
    const dbData = await getActivityData(msgId);

    if (dbData) {
        return { usersList: dbData.usersList, locked: dbData.locked };
    }

    const usersMap = await reaction.users.fetch({ limit: 100 });
    const usersList = [];
    for (const [userId, user] of usersMap) {
        if (!user.bot) {
            usersList.push(userId);
        }
    }
    const locked = usersList.length >= 3;
    await saveActivityData(msgId, usersList, locked);
    return { usersList, locked };
}

async function updateActivityBoard(message, usersList) {
    if (!message.embeds.length) return;

    const embed = message.embeds[0];
    const description = embed.description || '';
    const opisMatch = description.split(/### <:arrow:1543977081233342494> Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : null;

    const top1 = usersList[0] ? `<@${usersList[0]}>` : 'Brak';
    const top2 = usersList[1] ? `<@${usersList[1]}>` : 'Brak';
    const top3 = usersList[2] ? `<@${usersList[2]}>` : 'Brak';

    let newDescription =
        `# <a:checkmark:1543969158646206475> Aktywność check\n` +
        `## <a:top1:1548673656761352304> ${top1}\n` +
        `## <a:top2:1548673747983011891> ${top2}\n` +
        `## <a:top3:1548673801104138322> ${top3}\n\n` +
        `## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

    if (activityDescription) {
        newDescription += `\n\n### <:arrow:1543977081233342494> Opis: ${activityDescription}`;
    }

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
    await message.edit({ embeds: [updatedEmbed] });
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
            return interaction.reply({ 
                content: '# <a:dot:1543969325155745812> Błąd\n<:arrow:1543977081233342494> Nie znaleziono kanału aktywności.', 
                ephemeral: true 
            });
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
            embeds: [embed]
        });

        await sentMessage.react('1543969158646206475');

        await saveActivityData(sentMessage.id, [], false);

        return interaction.reply({ 
            content: '# <a:dot:1543969325155745812> Sukces\n<:arrow:1543977081233342494> Utworzono wiadomość aktywności na kanale <#' + channelId + '>.', 
            ephemeral: true 
        });
    },

    setupEvents(client) {
        async function handleReactionChange(reaction, user, isAdd) {
            if (user.bot) return;
            if (reaction.partial) {
                try { await reaction.fetch(); } catch (e) { console.error('Błąd pobierania reakcji:', e); return; }
            }
            if (reaction.message.partial) {
                try { await reaction.message.fetch(); } catch (e) { console.error('Błąd pobierania wiadomości:', e); return; }
            }
            if (reaction.emoji.id !== '1543969158646206475') return;

            const message = reaction.message;
            let { usersList, locked } = await getOrInitUsersList(reaction);

            if (locked) return;

            const index = usersList.indexOf(user.id);
            if (isAdd) {
                if (index === -1) {
                    usersList.push(user.id);
                }
            } else {
                if (index > -1) {
                    usersList.splice(index, 1);
                }
            }

            if (usersList.length >= 3) {
                locked = true;
            }

            await saveActivityData(message.id, usersList, locked);
            await updateActivityBoard(message, usersList);
        }

        client.on('messageReactionAdd', async (reaction, user) => {
            try {
                await handleReactionChange(reaction, user, true);
            } catch (error) {
                console.error('Błąd w messageReactionAdd:', error);
            }
        });

        client.on('messageReactionRemove', async (reaction, user) => {
            try {
                await handleReactionChange(reaction, user, false);
            } catch (error) {
                console.error('Błąd w messageReactionRemove:', error);
            }
        });
    }
};
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getDb } = require('../utils/database');

// Słownik emotek cyfr od 0 do 9
const DIGIT_EMOJIS = {
    '0': '<:0_:1543975892429053982>',
    '1': '<:1_:1543975655287558246>',
    '2': '<:2_:1543975728830480414>',
    '3': '<:3_:1543975757704073396>',
    '4': '<:4_:1543975782395813968>',
    '5': '<:5_:1543975804696920105>',
    '6': '<:6_:1543975832555495514>',
    '7': '<:7_:1543975850138140742>',
    '8': '<:8_:1543975862418800740>',
    '9': '<:9_:1543975879984554014>'
};

// Funkcja zamieniająca np. "31" na string z emotkami cyfr
function formatNumberToEmojis(numberStr) {
    return String(numberStr)
        .split('')
        .map(char => DIGIT_EMOJIS[char] || char)
        .join('');
}

async function getActivityData(messageId) {
    const db = getDb();
    if (!db) return null;
    return await db.collection('activity_checks').findOne({ messageId });
}

async function saveActivityData(messageId, usersList, locked) {
    const db = getDb();
    if (!db) return;
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
    
    // Dynamiczne wyciąganie dnia oraz opisu niezależnie od ich kolejności
    const parts = description.split('\n\n## <a:dot:1543969325155745812> ');
    let dzienEmotki = null;
    let activityDescription = null;

    for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('Dzień ')) {
            dzienEmotki = parts[i].replace('Dzień ', '').trim();
        } else if (parts[i].startsWith('Opis: ')) {
            activityDescription = parts[i].replace('Opis: ', '').trim();
        }
    }

    const top1 = usersList[0] ? `<@${usersList[0]}>` : 'Brak';
    const top2 = usersList[1] ? `<@${usersList[1]}>` : 'Brak';
    const top3 = usersList[2] ? `<@${usersList[2]}>` : 'Brak';

    let newDescription =
        `# <a:checkmark:1543969158646206475> Aktywność check\n` +
        `## <a:top1:1548673656761352304> ${top1}\n` +
        `## <a:top2:1548673747983011891> ${top2}\n` +
        `## <a:top3:1548673801104138322> ${top3}\n\n` +
        `## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

    if (dzienEmotki) {
        newDescription += `\n\n## <a:dot:1543969325155745812> Dzień ${dzienEmotki}`;
    }

    if (activityDescription) {
        newDescription += `\n\n## <a:dot:1543969325155745812> Opis: ${activityDescription}`;
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
                .setDescription('(opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('dzien')
                .setDescription('(opcjonalnie)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const opis = interaction.options.getString('opis');
        const dzienInput = interaction.options.getString('dzien');
        const targetChannelId = '1542122742768210000';

        let channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
        if (!channel) {
            channel = interaction.channel;
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

        if (dzienInput) {
            const formattedDzien = formatNumberToEmojis(dzienInput.trim());
            descriptionText += `\n\n## <a:dot:1543969325155745812> Dzień ${formattedDzien}`;
        }

        if (opis) {
            descriptionText += `\n\n## <a:dot:1543969325155745812> Opis: ${opis}`;
        }

        const embed = new EmbedBuilder()
            .setDescription(descriptionText)
            .setColor(16764416)
            .setFooter({
                text: `Stworzone przez @czlekowiek • Data: ${formattedTime}`
            });

        const sentMessage = await channel.send({
            content: '@everyone',
            embeds: [embed]
        });

        await sentMessage.react('1543969158646206475').catch(() => {});

        await saveActivityData(sentMessage.id, [], false);

        return interaction.editReply({ 
            content: '# <a:dot:1543969325155745812> Sukces\n<:arrow:1543977081233342494> Utworzono wiadomość aktywności na kanale <#' + channel.id + '>.' 
        });
    },

    setupEvents(client) {
        async function handleReactionChange(reaction, user, isAdd) {
            if (user.bot) return;
            if (reaction.partial) {
                try { await reaction.fetch(); } catch (e) { return; }
            }
            if (reaction.message.partial) {
                try { await reaction.message.fetch(); } catch (e) { return; }
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
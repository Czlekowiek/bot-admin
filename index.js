const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const http = require('http');
const { generateStaffEmbed } = require('./utils/sklad-administracji');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot administracyjny dziala 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();
const commands = [];

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

const CHANNEL_IDS = [
    '1548638166389366834',
    '1542122713676644352'
];

const LOG_CHANNEL_ID = '1548682257320120380';

// Funkcja pomocnicza do wysyłania logów
async function sendLog(content) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) {
            await channel.send({ content });
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania logu:', error);
    }
}

async function updateAdminMessage(guild) {
    try {
        const newEmbed = await generateStaffEmbed(guild);

        for (const channelId of CHANNEL_IDS) {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;

            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            let botMessage = messages ? messages.find(m => m.author.id === client.user.id) : null;

            if (botMessage) {
                await botMessage.edit({ content: null, embeds: [newEmbed] });
            } else {
                await channel.send({ embeds: [newEmbed] });
            }
        }
    } catch (error) {
        console.error('Błąd podczas aktualizacji wiadomości:', error);
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);
    await sendLog(`🟢 **Bot został uruchomiony!** Zalogowano jako \`${client.user.tag}\`.`);

    const guild = client.guilds.cache.first();
    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands },
            );
        } catch (error) {
            console.error(error);
        }

        await updateAdminMessage(guild);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Logowanie użycia komendy
    await sendLog(`⚙️ Użytkownik **${interaction.user.tag}** użył komendy \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await sendLog(`❌ Błąd podczas wykonywania komendy \`/${interaction.commandName}\` przez **${interaction.user.tag}**: \`${error.message}\``);
        
        const replyOptions = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    }
});

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

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.emoji.id !== '1543969158646206475') return;

    const usersList = await getOrCreateUsersList(reaction);
    if (!usersList.includes(user.id)) {
        usersList.push(user.id);
    }

    await updateActivityBoard(reaction.message, usersList);
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.emoji.id !== '1543969158646206475') return;

    const usersList = await getOrCreateUsersList(reaction);
    const index = usersList.indexOf(user.id);
    if (index > -1) {
        usersList.splice(index, 1);
    }

    await updateActivityBoard(reaction.message, usersList);
});

async function updateActivityBoard(message, usersList) {
    if (!message.embeds.length) return;
    const embed = message.embeds[0];
    const description = embed.description;

    const opisMatch = description.split(/Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : null;

    const top1 = usersList[0] ? `<@${usersList[0]}>` : 'Brak';
    const top2 = usersList[1] ? `<@${usersList[1]}>` : 'Brak';
    const top3 = usersList[2] ? `<@${usersList[2]}>` : 'Brak';

    let newDescription = `# <a:checkmark:1543969158646206475> Aktywność check\n## <a:top1:1548673656761352304> 1. ${top1}\n## <a:top2:1548673747983011891> 2. ${top2}\n## <a:top3:1548673801104138322> 3. ${top3}\n\n## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

    if (activityDescription) {
        newDescription += `\n\nOpis: ${activityDescription}`;
    }

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
    await message.edit({ embeds: [updatedEmbed] });
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await updateAdminMessage(newMember.guild);
});

// Nasłuchiwanie wyłączenia lub restartu procesów Node.js
process.on('SIGINT', async () => {
    await sendLog('🔴 **Bot został wyłączony / zrestartowany!**');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await sendLog('🔴 **Bot został wyłączony / zrestartowany!**');
    process.exit(0);
});

client.login('MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU');

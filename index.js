const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    REST,
    Routes,
    EmbedBuilder
} = require('discord.js');

const http = require('http');

const { generateStaffEmbed } = require('./utils/sklad-administracji');
const { sendWelcomeMessage } = require('./utils/welcome');
const { sendLeaveMessage } = require('./utils/bye');

// =========================================================
// HTTP SERVER - RENDER
// =========================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });

    res.end('Bot administracyjny dziala 24/7!\n');
});

server.listen(process.env.PORT || 3000);

// =========================================================
// CLIENT
// =========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],

    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// =========================================================
// COMMANDS
// =========================================================

client.commands = new Collection();

const commands = [];

// =========================================================
// CHANNELS
// =========================================================

const CHANNEL_IDS = [
    '1548638166389366834',
    '1542122713676644352'
];

const LOG_CHANNEL_ID = '1548682257320120380';

// =========================================================
// LOGI
// =========================================================

async function sendLog(content) {
    try {
        const channel = await client.channels
            .fetch(LOG_CHANNEL_ID)
            .catch(() => null);

        if (channel) {
            await channel.send({
                content
            });
        }
    } catch (error) {
        console.error(
            'Błąd podczas wysyłania logu:',
            error
        );
    }
}

// =========================================================
// WERSJE KOMEND
// =========================================================

const versionsFilePath = path.join(
    __dirname,
    'command-versions.json'
);

let savedVersions = {};

if (fs.existsSync(versionsFilePath)) {
    try {
        savedVersions = JSON.parse(
            fs.readFileSync(
                versionsFilePath,
                'utf8'
            )
        );
    } catch (e) {
        savedVersions = {};
    }
}

const commandsPath = path.join(
    __dirname,
    'commands'
);

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

const currentVersions = {};
const modifiedCommands = [];

// =========================================================
// WCZYTYWANIE KOMEND
// =========================================================

for (const file of commandFiles) {
    const filePath = path.join(
        commandsPath,
        file
    );

    const stats = fs.statSync(filePath);

    currentVersions[file] = stats.mtimeMs;

    if (
        savedVersions[file] !== undefined &&
        savedVersions[file] !== stats.mtimeMs
    ) {
        modifiedCommands.push(
            file.replace('.js', '')
        );
    }

    const command = require(filePath);

    if (
        'data' in command &&
        'execute' in command
    ) {
        client.commands.set(
            command.data.name,
            command
        );

        commands.push(
            command.data.toJSON()
        );
    }
}

fs.writeFileSync(
    versionsFilePath,
    JSON.stringify(
        currentVersions,
        null,
        2
    )
);

// =========================================================
// AKTUALIZACJA SKŁADU ADMINISTRACJI
// =========================================================

async function updateAdminMessage(guild) {
    try {
        const newEmbed = await generateStaffEmbed(guild);

        for (const channelId of CHANNEL_IDS) {
            const channel = await guild.channels
                .fetch(channelId)
                .catch(() => null);

            if (!channel) continue;

            const messages = await channel.messages
                .fetch({
                    limit: 10
                })
                .catch(() => null);

            const botMessage = messages
                ? messages.find(
                    m => m.author.id === client.user.id
                )
                : null;

            if (botMessage) {
                await botMessage.edit({
                    content: null,
                    embeds: [newEmbed]
                });
            } else {
                await channel.send({
                    embeds: [newEmbed]
                });
            }
        }

    } catch (error) {
        console.error(
            'Błąd podczas aktualizacji wiadomości:',
            error
        );
    }
}

// =========================================================
// READY
// =========================================================

client.once('ready', async () => {
    console.log(
        `Zalogowano jako ${client.user.tag}!`
    );

    setTimeout(async () => {

        await sendLog(
            `Bot został uruchomiony. Zalogowano jako \`${client.user.tag}\`.`
        );

        if (modifiedCommands.length > 0) {

            const list = modifiedCommands
                .map(c => `\`/${c}\``)
                .join(', ');

            await sendLog(
                `Wykryto zmianę kodu w komendach: ${list}`
            );
        }

    }, 2000);

    const guild = client.guilds.cache.first();

    if (guild) {

        const rest = new REST({
            version: '10'
        }).setToken(client.token);

        try {

            await rest.put(
                Routes.applicationGuildCommands(
                    client.user.id,
                    guild.id
                ),
                {
                    body: commands
                }
            );

        } catch (error) {

            console.error(error);

            await sendLog(
                `❌ **Błąd podczas rejestrowania komend:** \`${error.message}\``
            );
        }

        await updateAdminMessage(guild);
    }
});

// =========================================================
// POWITANIA
// =========================================================

client.on(
    'guildMemberAdd',
    async member => {

        try {

            await sendWelcomeMessage(member);

        } catch (error) {

            console.error(
                '❌ Błąd podczas wysyłania powitania:',
                error
            );
        }
    }
);

// =========================================================
// POŻEGNANIA
// =========================================================

client.on(
    'guildMemberRemove',
    async member => {

        try {

            await sendLeaveMessage(member);

        } catch (error) {

            console.error(
                '❌ Błąd podczas wysyłania pożegnania:',
                error
            );
        }
    }
);

// =========================================================
// KOMENDY SLASH
// =========================================================

client.on(
    'interactionCreate',
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }

        const command = client.commands.get(
            interaction.commandName
        );

        if (!command) {
            return;
        }

        await sendLog(
            `Użytkownik ${interaction.user.tag} użył komendy \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`
        );

        try {

            await command.execute(interaction);

        } catch (error) {

            console.error(error);

            await sendLog(
                `❌ **Błąd podczas wykonywania komendy** \`/${interaction.commandName}\` przez ${interaction.user.tag}: \`${error.message}\``
            );

            const replyOptions = {
                content:
                    'Wystąpił błąd podczas wykonywania tej komendy!',
                ephemeral: true
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.followUp(
                    replyOptions
                );

            } else {

                await interaction.reply(
                    replyOptions
                );
            }
        }
    }
);

// =========================================================
// HISTORIA REAKCJI
// =========================================================

const reactionHistory = new Map();

// =========================================================
// POBIERANIE LISTY UŻYTKOWNIKÓW Z REAKCJI
// =========================================================

async function getOrCreateUsersList(reaction) {

    const msgId = reaction.message.id;

    if (!reactionHistory.has(msgId)) {

        const usersMap =
            await reaction.users.fetch({
                limit: 100
            });

        const usersList = [];

        for (const [userId, user] of usersMap) {

            if (!user.bot) {
                usersList.push(userId);
            }
        }

        reactionHistory.set(
            msgId,
            usersList
        );
    }

    return reactionHistory.get(msgId);
}

// =========================================================
// DODANIE REAKCJI
// =========================================================

client.on(
    'messageReactionAdd',
    async (reaction, user) => {

        if (user.bot) return;

        if (reaction.partial) {

            try {
                await reaction.fetch();
            } catch {
                return;
            }
        }

        if (reaction.message.partial) {

            try {
                await reaction.message.fetch();
            } catch {
                return;
            }
        }

        if (
            reaction.emoji.id !==
            '1543969158646206475'
        ) {
            return;
        }

        const usersList =
            await getOrCreateUsersList(
                reaction
            );

        if (!usersList.includes(user.id)) {
            usersList.push(user.id);
        }

        await updateActivityBoard(
            reaction.message,
            usersList
        );
    }
);

// =========================================================
// USUNIĘCIE REAKCJI
// =========================================================

client.on(
    'messageReactionRemove',
    async (reaction, user) => {

        if (user.bot) return;

        if (reaction.partial) {

            try {
                await reaction.fetch();
            } catch {
                return;
            }
        }

        if (reaction.message.partial) {

            try {
                await reaction.message.fetch();
            } catch {
                return;
            }
        }

        if (
            reaction.emoji.id !==
            '1543969158646206475'
        ) {
            return;
        }

        const usersList =
            await getOrCreateUsersList(
                reaction
            );

        const index =
            usersList.indexOf(user.id);

        if (index > -1) {
            usersList.splice(index, 1);
        }

        await updateActivityBoard(
            reaction.message,
            usersList
        );
    }
);

// =========================================================
// TABLICA AKTYWNOŚCI
// =========================================================

async function updateActivityBoard(
    message,
    usersList
) {

    if (!message.embeds.length) {
        return;
    }

    const embed = message.embeds[0];

    const description =
        embed.description;

    const opisMatch =
        description.split(
            /### Opis: /
        );

    const activityDescription =
        opisMatch[1]
            ? opisMatch[1]
            : null;

    const top1 =
        usersList[0]
            ? `<@${usersList[0]}>`
            : 'Brak';

    const top2 =
        usersList[1]
            ? `<@${usersList[1]}>`
            : 'Brak';

    const top3 =
        usersList[2]
            ? `<@${usersList[2]}>`
            : 'Brak';

    let newDescription =
        `# Aktywność check\n` +
        `## 1. ${top1}\n` +
        `## 2. ${top2}\n` +
        `## 3. ${top3}\n\n` +
        `## Zareaguj emotką poniżej aby zaznaczyć aktywność.`;

    if (activityDescription) {

        newDescription +=
            `\n\n### Opis: ${activityDescription}`;
    }

    const updatedEmbed =
        EmbedBuilder
            .from(embed)
            .setDescription(
                newDescription
            );

    await message.edit({
        embeds: [updatedEmbed]
    });
}

// =========================================================
// AKTUALIZACJA SKŁADU PO ZMIANIE CZŁONKA
// =========================================================

client.on(
    'guildMemberUpdate',
    async (oldMember, newMember) => {

        await updateAdminMessage(
            newMember.guild
        );
    }
);

// =========================================================
// ZAMYKANIE PROCESU
// =========================================================

process.on(
    'SIGINT',
    () => {
        process.exit(0);
    }
);

process.on(
    'SIGTERM',
    () => {
        process.exit(0);
    }
);

// =========================================================
// LOGOWANIE BOTA
// =========================================================

client.login(
    'MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU'
);

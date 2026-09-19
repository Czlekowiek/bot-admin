const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');

const { generateStaffEmbed } = require('./utils/sklad-administracji');
const { sendWelcomeMessage } = require('./utils/welcome');
const { sendLeaveMessage } = require('./utils/bye');

// =========================================================
// HTTP SERVER - RENDER
// =========================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
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
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
const commands = [];
const CHANNEL_IDS = ['1548638166389366834', '1542122713676644352'];
const LOG_CHANNEL_ID = '1548682257320120380';

async function sendLog(content) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) await channel.send({ content });
    } catch (error) {
        console.error('Błąd podczas wysyłania logu:', error);
    }
}

// =========================================================
// ŁADOWANIE KOMEND I EVENTÓW MODUŁOWYCH
// =========================================================

const versionsFilePath = path.join(__dirname, 'command-versions.json');
let savedVersions = fs.existsSync(versionsFilePath) ? JSON.parse(fs.readFileSync(versionsFilePath, 'utf8')) : {};

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.existsSync(commandsPath) ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')) : [];
const currentVersions = {};
const modifiedCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const stats = fs.statSync(filePath);
    currentVersions[file] = stats.mtimeMs;

    if (savedVersions[file] !== undefined && savedVersions[file] !== stats.mtimeMs) {
        modifiedCommands.push(file.replace('.js', ''));
    }

    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
    // Automatyczne podpinanie eventów z modułów (weryfikacja, dowod, aktywnosc)
    if (typeof command.setupEvents === 'function') {
        command.setupEvents(client);
    }
}

if (commandFiles.length > 0) {
    fs.writeFileSync(versionsFilePath, JSON.stringify(currentVersions, null, 2));
}

// =========================================================
// AKTUALIZACJA SKŁADU ADMINISTRACJI
// =========================================================

async function updateAdminMessage(guild) {
    try {
        const newEmbed = await generateStaffEmbed(guild);
        for (const channelId of CHANNEL_IDS) {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            const botMessage = messages ? messages.find(m => m.author.id === client.user.id) : null;
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

// =========================================================
// READY
// =========================================================

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);
    setTimeout(async () => {
        await sendLog(`Bot został uruchomiony. Zalogowano jako \`${client.user.tag}\`.`);
        if (modifiedCommands.length > 0) {
            await sendLog(`Wykryto zmianę kodu w komendach: ${modifiedCommands.map(c => `\`/${c}\``).join(', ')}`);
        }
    }, 2000);

    const guild = client.guilds.cache.first();
    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
        } catch (error) {
            console.error(error);
            await sendLog(`❌ **Błąd podczas rejestrowania komend:** \`${error.message}\``);
        }
        await updateAdminMessage(guild);
    }
});

// =========================================================
// POWITANIA / POŻEGNANIA
// =========================================================

client.on('guildMemberAdd', async member => {
    try { await sendWelcomeMessage(member); } catch (e) {}
});

client.on('guildMemberRemove', async member => {
    try { await sendLeaveMessage(member); } catch (e) {}
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await updateAdminMessage(newMember.guild);
});

// =========================================================
// UNIWERSALNA OBSŁUGA KOMEND SLASH
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.execute !== 'function') return;

    await sendLog(`Użytkownik ${interaction.user.tag} użył komendy \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`);
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await sendLog(`❌ **Błąd podczas wykonywania komendy** \`/${interaction.commandName}\` przez ${interaction.user.tag}: \`${error.message}\``);
        const replyOptions = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions);
        else await interaction.reply(replyOptions);
    }
});

// =========================================================
// ZAMYKANIE PROCESU I LOGOWANIE
// =========================================================

process.on('SIGINT', () => { process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });

client.login('MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU');

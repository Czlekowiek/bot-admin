const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');

const { connectDB } = require('./utils/database');
const { generateStaffEmbed } = require('./utils/sklad-administracji');
const { sendWelcomeMessage } = require('./utils/welcome');
const { sendLeaveMessage } = require('./utils/bye');

// =========================================================
// MONGODB CONNECTION
// =========================================================
connectDB();

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

// POPRAWKA 1: try/catch przy ładowaniu każdej komendy — crash przy błędnym pliku
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const stats = fs.statSync(filePath);
    currentVersions[file] = stats.mtimeMs;

    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[OSTRZEŻENIE] Komenda ${file} nie ma wymaganych pól 'data' lub 'execute'.`);
        }
        // POPRAWKA 2: setupEvents opóźnione do eventu 'ready' — żeby bot był gotowy
        // (przeniesione niżej, do client.once('ready'))
    } catch (error) {
        console.error(`[BŁĄD] Nie udało się załadować komendy ${file}:`, error);
    }
}

// Zapisz wersje plików komend
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

    // POPRAWKA 2: setupEvents wywołane tutaj — bot jest już gotowy
    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath); // Node cachuje require, nie ładuje ponownie
            if (typeof command.setupEvents === 'function') {
                command.setupEvents(client);
            }
        } catch (error) {
            console.error(`[BŁĄD] setupEvents w ${file}:`, error);
        }
    }

    // POPRAWKA 3: sendLog bez arbitralnego setTimeout — czekamy aż fetch kanału się powiedzie
    try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                content: `# <a:dot:1543969325155745812> **Bot został uruchomiony**\n<:arrow:1543977081233342494> Zalogowano jako: \`${client.user.tag}\``
            });
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania logu startowego:', error);
    }

    const guild = client.guilds.cache.first();
    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
            console.log('Komendy slash zarejestrowane pomyślnie.');
        } catch (error) {
            console.error('Błąd podczas rejestracji komend:', error);
        }
        await updateAdminMessage(guild);
    }
});

// =========================================================
// POWITANIA / POŻEGNANIA
// =========================================================

client.on('guildMemberAdd', async member => {
    try { await sendWelcomeMessage(member); } catch (e) {
        console.error('Błąd sendWelcomeMessage:', e);
    }
});

client.on('guildMemberRemove', async member => {
    try { await sendLeaveMessage(member); } catch (e) {
        console.error('Błąd sendLeaveMessage:', e);
    }
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

    // Log w tle, nie blokuje bota
    sendLog(`# <a:dot:1543969325155745812> **Użycie komendy**\n<:arrow:1543977081233342494> Użytkownik **${interaction.user.tag}** (\`${interaction.user.id}\`) użył \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`).catch(() => {});

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Błąd podczas wykonywania komendy ${interaction.commandName}:`, error);
        const replyOptions = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions).catch(() => {});
        else await interaction.reply(replyOptions).catch(() => {});
    }
});

// =========================================================
// EKSPORT KLIENTA
// =========================================================

module.exports = { client };

// =========================================================
// ZAMYKANIE PROCESU I LOGOWANIE
// =========================================================

process.on('SIGINT', () => { process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });

// POPRAWKA 4: obsługa błędu logowania — token nieprawidłowy / brak zmiennej środowiskowej
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('Nie można zalogować bota — sprawdź DISCORD_TOKEN:', err);
    process.exit(1);
});
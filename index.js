const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');

const { generateStaffEmbed } = require('./utils/sklad-administracji');
const { sendWelcomeMessage } = require('./utils/welcome');
const { sendLeaveMessage } = require('./utils/bye');
const { setupGlobalLogs, sendLog } = require('./utils/logs'); // <- Nowy system logów

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
const CHANNEL_IDS = ['1548682257320120380', '1542122713676644352']; // Dopasuj do swoich ID kanałów administracyjnych

// Uruchomienie globalnych logów
setupGlobalLogs(client);

// =========================================================
// ŁADOWANIE KOMEND I EVENTÓW MODUŁOWYCH
// =========================================================

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.existsSync(commandsPath) ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')) : [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
    if (typeof command.setupEvents === 'function') {
        command.setupEvents(client);
    }
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

    const guild = client.guilds.cache.first();
    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
        } catch (error) {
            console.error(error);
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
// TABLICA AKTYWNOŚCI (REAKCJE)
// =========================================================

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

async function updateActivityBoard(message, usersList) {
    if (!message.embeds.length) return;

    const embed = message.embeds[0];
    const description = embed.description;
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

// =========================================================
// OBSŁUGA MODALA KOMENDY /SEND
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('modal_send_')) {
        await interaction.deferReply({ ephemeral: true });

        const typ = interaction.customId.split('_')[2];
        const tresc = interaction.fields.getTextInputValue('send_content');
        const kanał = interaction.channel;

        try {
            if (typ === 'wiadomosc') {
                await kanał.send({ content: tresc });
            } else if (typ === 'embed') {
                const embed = new EmbedBuilder()
                    .setColor(0xFFCE00) // Stały kolor #FFCE00
                    .setDescription(tresc);

                await kanał.send({ embeds: [embed] });
            }

            await sendLog(client, `<a:neon_staff:1550909470605844650> Użytkownik **${interaction.user.tag}** wysłał oficjalną wiadomość (${typ}) za pomocą komendy \`/send\` na kanale <#${kanał.id}>.`);

            return interaction.editReply({ content: '<a:greentick:1543991524738465853> Wiadomość została pomyślnie wysłana na tym kanale!' });
        } catch (error) {
            console.error('Błąd podczas wysyłania wiadomości przez /send:', error);
            return interaction.editReply({ content: '<a:redtick:1543991522192527450> Wystąpił błąd podczas wysyłania wiadomości.' });
        }
    }
});

// =========================================================
// UNIWERSALNA OBSŁUGA KOMEND SLASH
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.execute !== 'function') return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const replyOptions = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions);
        else await interaction.reply(replyOptions);
    }
});

// =========================================================
// ZAMYKANIE PROCESU
// =========================================================

process.on('SIGINT', () => { process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });

client.login(process.env.DISCORD_TOKEN);

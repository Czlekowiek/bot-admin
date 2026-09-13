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
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Kolekcja na komendy bota
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
        
        console.log('Zaktualizowano listę administracji na wszystkich kanałach!');
    } catch (error) {
        console.error('Błąd podczas aktualizacji wiadomości:', error);
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);

    const guild = client.guilds.cache.first();
    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands },
            );
            console.log('Zarejestrowano komendy Slash pomyślnie!');
        } catch (error) {
            console.error(error);
        }

        await updateAdminMessage(guild);
    }
});

// Obsługa wykonywania komend przez użytkowników
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true });
        }
    }
});

// System aktualizacji Top 3 aktywności po dodaniu reakcji
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.id !== '1543969158646206475') return;

    await updateActivityBoard(reaction.message);
});

// System aktualizacji Top 3 aktywności po usunięciu reakcji
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.id !== '1543969158646206475') return;

    await updateActivityBoard(reaction.message);
});

async function updateActivityBoard(message) {
    if (!message.embeds.length) return;
    const embed = message.embeds[0];
    const description = embed.description;

    const opisMatch = description.split(/Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : '';

    const reaction = message.reactions.cache.get('1543969158646206475');
    if (!reaction) return;

    const users = await reaction.users.fetch();
    const humanUsers = Array.from(users.values()).filter(u => !u.bot);

    const top1 = humanUsers[0] ? `<@${humanUsers[0].id}>` : 'Brak';
    const top2 = humanUsers[1] ? `<@${humanUsers[1].id}>` : 'Brak';
    const top3 = humanUsers[2] ? `<@${humanUsers[2].id}>` : 'Brak';

    const newDescription = `## <a:top1:1548673656761352304> 1. ${top1}\n## <a:top2:1548673747983011891> 2. ${top2}\n## <a:top3:1548673801104138322> 3. ${top3}\n\n<a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.\n\nOpis: ${activityDescription}`;

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
    await message.edit({ embeds: [updatedEmbed] });
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await updateAdminMessage(newMember.guild);
});

client.login('MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU');

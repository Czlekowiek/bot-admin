const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot administracyjny dziala 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const CHANNEL_ID = '1548638166389366834';
const MESSAGE_ID = '1548638486343450685';

const ROLES_TO_TRACK = [
    { id: '1548633496220864624', name: '👑 Rola 1' },
    { id: '1548633906969051156', name: '🛡️ Rola 2' },
    { id: '1548633531482247188', name: '🔧 Rola 3' },
    { id: '1548633569814122617', name: '⭐ Rola 4' }
];

async function generateEmbed(guild) {
    const embed = new EmbedBuilder()
        .setTitle('📋 Skład Administracji')
        .setColor('#2b2d31')
        .setTimestamp();

    for (const roleData of ROLES_TO_TRACK) {
        const role = await guild.roles.fetch(roleData.id).catch(() => null);
        let membersList = 'Brak osób';
        if (role && role.members.size > 0) {
            membersList = role.members.map(member => `<@${member.id}>`).join('\n');
        }
        embed.addFields({ name: roleData.name, value: membersList, inline: false });
    }
    return embed;
}

async function updateAdminMessage(guild) {
    try {
        const channel = await guild.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return console.log('Nie znaleziono kanału!');

        const message = await channel.messages.fetch(MESSAGE_ID).catch(() => null);
        if (!message) return console.log('Nie znaleziono wiadomości o podanym ID!');

        const newEmbed = await generateEmbed(guild);
        await message.edit({ embeds: [newEmbed], content: '' }); 
        console.log('Zaktualizowano listę administracji!');
    } catch (error) {
        console.error('Błąd podczas aktualizacji wiadomości:', error);
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);
    const guild = client.guilds.cache.first();
    if (guild) {
        await updateAdminMessage(guild);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const oldRoles = oldMember.roles.cache.size;
    const newRoles = newMember.roles.cache.size;

    if (oldRoles !== newRoles) {
        await updateAdminMessage(newMember.guild);
    }
});

client.login('MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU');
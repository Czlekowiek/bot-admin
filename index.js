const { Client, GatewayIntentBits } = require('discord.js');
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
        GatewayIntentBits.GuildMembers
    ]
});

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
        await updateAdminMessage(guild);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await updateAdminMessage(newMember.guild);
});

client.login('MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU');

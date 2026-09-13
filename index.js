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

// Twoje role dopasowane do struktury (zgodnie z ID podanymi wcześniej)
const ROLES_TO_TRACK = [
    { id: '1548633496220864624', name: 'Właściciel' },
    { id: '1548633906969051156', name: 'Technik' },
    { id: '1548633531482247188', name: 'Admin' },
    { id: '1548633569814122617', name: 'Rola 4' }
];

let targetMessage = null;

async function generateEmbed(guild) {
    let descriptionText = '';

    for (const roleData of ROLES_TO_TRACK) {
        const role = await guild.roles.fetch(roleData.id).catch(() => null);
        
        let membersList = '<:arrow:1543977081233342494> Brak osób';
        if (role && role.members.size > 0) {
            membersList = role.members.map(member => `<:arrow:1543977081233342494> <@${member.id}>`).join('\n');
        }

        descriptionText += `## <a:dot:1543969325155745812> ${roleData.name}\n${membersList}\n\n`;
    }

    const embed = new EmbedBuilder()
        .setDescription(descriptionText.trim())
        .setColor(16764416)
        .setFooter({
            text: 'Stworzone przez @czlekowiek',
            icon_url: 'https://cdn.discordapp.com/attachments/1548638166389366834/1548644226399600680/czlekowiek-avatar-1024.png'
        });

    return embed;
}

async function updateAdminMessage(guild) {
    try {
        const channel = await guild.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return console.log('Nie znaleziono kanału!');

        const newEmbed = await generateEmbed(guild);
        const contentText = '# <:staff:1548644739237027902> Skład Administracji';

        if (!targetMessage) {
            const messages = await channel.messages.fetch({ limit: 10 });
            targetMessage = messages.find(m => m.author.id === client.user.id);
        }

        if (targetMessage) {
            await targetMessage.edit({ content: contentText, embeds: [newEmbed] });
        } else {
            targetMessage = await channel.send({ content: contentText, embeds: [newEmbed] });
        }
        
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

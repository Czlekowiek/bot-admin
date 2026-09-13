const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
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

// Lista kanałów, na które bot wysyła i aktualizuje wiadomość
const CHANNEL_IDS = [
    '1548638166389366834',
    '1542122713676644352'
];

// Ostateczna kolejność ról
const ROLES_TO_TRACK = [
    { id: '1542127037202825326', name: '<:owner_gradient:1548652163272675452> Właściciel' },
    { id: '1542127233093869701', name: '<:admin_yellow:1548649419434627246> Współwłaściciel' },
    { id: '1543676695377215629', name: '<:admin_darkpurple:1548650402503852032> Technik' },
    { id: '1542128389274472458', name: '<:admin_red:1548649297724047450> Admin' },
    { id: '1542991925521420330', name: '<:admin_orange:1548649349834080327> Junior Admin' },
    { id: '1542127336193785886', name: '<:admin_blue:1548649538389024768> Developer' },
    { id: '1543996411350098010', name: '<:admin_turquoise:1548650090703491153> Zarząd Frakcji' }
];

async function generateEmbedAndFiles() {
    const guild = client.guilds.cache.first();
    if (guild) {
        await guild.members.fetch().catch(() => {});
    }

    let descriptionText = '# <:staff:1548644739237027902> Skład administracji serwera\n';

    if (guild) {
        for (const roleData of ROLES_TO_TRACK) {
            const role = await guild.roles.fetch(roleData.id).catch(() => null);
            
            let membersList = '<:arrow:1543977081233342494> Brak osób';
            
            if (role && role.members.size > 0) {
                membersList = role.members.map(member => `<:arrow:1543977081233342494> <@${member.id}>`).join('\n');
            }

            descriptionText += `## ${roleData.name}\n${membersList}\n`;
        }
    }

    // Pobranie aktualnego czasu w czytelnym formacie PL
    const now = new Date();
    const formattedTime = now.toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Tworzenie załącznika z bezpośredniego linku graficznego
    const file = new AttachmentBuilder('https://cdn.discordapp.com/attachments/1548638166389366834/1548644226399600680/czlekowiek-avatar-1024.png', { name: 'avatar.png' });

    const embed = new EmbedBuilder()
        .setDescription(descriptionText.trim())
        .setColor(16764416)
        .setFooter({
            text: `Stworzone przez @czlekowiek • Ostatnia aktualizacja: ${formattedTime}`,
            icon_url: 'attachment://avatar.png' // Odwołanie do lokalnie załączonego pliku
        });

    return { embeds: [embed], files: [file] };
}

async function updateAdminMessage(guild) {
    try {
        const messagePayload = await generateEmbedAndFiles();

        for (const channelId of CHANNEL_IDS) {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.log(`Nie znaleziono kanału o ID: ${channelId}`);
                continue;
            }

            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            let botMessage = messages ? messages.find(m => m.author.id === client.user.id) : null;

            if (botMessage) {
                await botMessage.edit({ content: null, embeds: messagePayload.embeds, files: messagePayload.files });
            } else {
                await channel.send({ embeds: messagePayload.embeds, files: messagePayload.files });
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

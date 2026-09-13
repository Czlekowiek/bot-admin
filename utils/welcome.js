const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { drawCard } = require('discord-welcome-card');

async function sendWelcomeMessage(member) {
    try {
        const WELCOME_CHANNEL_ID = '1542121319263641682';
        const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const memberCount = member.guild.memberCount;
        const createdAt = member.user.createdAt;
        const formattedDate = createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        const username = member.user.username;
        const serverName = member.guild.name;

        // Generowanie karty z awatarem na środku i tekstem pod spodem
        const image = await drawCard({
            theme: 'dark',
            text: {
                title: serverName,
                text: username,
                subtitle: `Jesteś naszym ${memberCount} członkiem`,
                color: '#ffffff'
            },
            avatar: {
                image: avatarURL,
                rounded: true,
                outlineWidth: 5,
                outlineColor: '#ffffff'
            },
            card: {
                background: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1000&auto=format&fit=crop',
                blur: 1,
                rounded: true
            }
        });

        const attachment = new AttachmentBuilder(image, { name: 'welcome-banner.png' });

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${username}\n\n` +
                `Cześć **${username}**! Witaj na **${serverName}**!\n` +
                `Jesteś naszym **${memberCount}** członkiem. Miłego pobytu!`
            )
            .setImage('attachment://welcome-banner.png')
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('Błąd podczas wysyłania powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

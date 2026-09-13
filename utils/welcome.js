const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { WelcomeBuilder } = require('discord-card-canvas');

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

        // Samodzielne generowanie banera graficznego przez bota
        const card = await new WelcomeBuilder({
            fontDefault: 'Inter',
            backgroundImgURL: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1000&auto=format&fit=crop',
            avatarImgURL: avatarURL,
            avatarBorderColor: '#ffffff',
            avatarBackgroundColor: '#1e1e1e',
            overlayOpacity: 0.4,
            mainText: {
                content: serverName,
                color: '#ffffff',
                size: 42
            },
            nicknameText: {
                content: username,
                color: '#ffaa00',
                size: 36
            },
            secondText: {
                content: `Jesteś naszym ${memberCount} członkiem!`,
                color: '#dddddd',
                size: 26
            }
        }).build();

        const attachment = new AttachmentBuilder(card.toBuffer(), { name: 'welcome-banner.png' });

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
        console.error('Błąd podczas generowania i wysyłania powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

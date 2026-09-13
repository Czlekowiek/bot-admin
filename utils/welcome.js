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

        // Dokładne dopasowanie czcionki, brak licznika na banerze i prawidłowa nazwa serwera
        const card = await new WelcomeBuilder({
            fontDefault: 'Arial',
            backgroundImgURL: 'https://dreamtours.pl/img/uploads/1759222213_darlowo_z_lotu-Aq5e0Pjf7wSo.jpg',
            avatarImgURL: avatarURL,
            avatarBorderColor: '#ffffff',
            avatarBackgroundColor: '#1e1e1e',
            blur: 2,
            opacity: 0.6,
            rounded: true,
            mainText: {
                content: username,
                color: '#ffffff',
                size: 40
            },
            nicknameText: {
                content: '',
                size: 0
            },
            secondText: {
                content: 'Polskie Drogi Roleplay',
                color: '#b0b0b0',
                size: 22
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

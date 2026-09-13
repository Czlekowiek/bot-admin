const { EmbedBuilder } = require('discord.js');

async function sendWelcomeMessage(member) {
    try {
        const WELCOME_CHANNEL_ID = '1542121319263641682';
        const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const memberCount = member.guild.memberCount;
        const createdAt = member.user.createdAt;
        const formattedDate = createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${member.user.username}\n\n` +
                `Cześć **${member.user.username}**! Witaj na **Polskie Drogi.Roleplay**!\n` +
                `Jesteś naszym **${memberCount}** członkiem. Miłego pobytu!`
            )
            .setImage(avatarURL)
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Błąd podczas wysyłania powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

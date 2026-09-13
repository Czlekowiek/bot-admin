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
        const username = member.user.username;
        const serverName = member.guild.name;

        // Używamy darmowego generatora banerów powitalnych
        const bannerURL = `https://api.popcat.xyz/welcome?background=https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1000&auto=format&fit=crop&avatar=${avatarURL}&text1=${encodeURIComponent(username)}&text2=${encodeURIComponent(serverName)}&text3=${encodeURIComponent(`Jesteś naszym ${memberCount} członkiem`)}`;

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${username}\n\n` +
                `Cześć **${username}**! Witaj na **${serverName}**!\n` +
                `Jesteś naszym **${memberCount}** członkiem. Miłego pobytu!`
            )
            .setImage(bannerURL)
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Błąd podczas wysyłania powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

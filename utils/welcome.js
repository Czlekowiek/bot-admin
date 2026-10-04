const { EmbedBuilder } = require('discord.js');
const { generateBanner } = require('./canvas-banner');

async function sendWelcomeMessage(member) {
    try {
        const channel = await member.guild.channels.fetch('1542121319263641682').catch(() => null);
        if (!channel) return;

        const attachment = await generateBanner(member, 'https://i.imgur.com/jYhAJz6.png', 'welcome');
        const formattedDate = member.user.createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const displayName = member.displayName;

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(`### ${displayName}\n\nCześć **${displayName}**! Witaj na **${member.guild.name}**!\nJesteś naszym **${member.guild.memberCount}** członkiem. Miłego pobytu!`)
            .setImage('attachment://welcome-banner.png')
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('❌ Błąd powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

const { EmbedBuilder } = require('discord.js');
const { generateBanner } = require('./canvas-banner');

async function sendLeaveMessage(member) {
    try {
        const channel = await member.guild.channels.fetch('1542121319263641683').catch(() => null);
        if (!channel) return;

        const attachment = await generateBanner(member, 'https://iili.io/nqeNgnV.png', 'leave');
        const formattedDate = member.user.createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const displayName = member.displayName;

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(`### ${displayName}\n\nPa! **${displayName}** opuścił **${member.guild.name}**, teraz mamy **${member.guild.memberCount}** członków.`)
            .setImage('attachment://leave-banner.png')
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('❌ Błąd pożegnania:', error);
    }
}

module.exports = { sendLeaveMessage };

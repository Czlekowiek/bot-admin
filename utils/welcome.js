const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');

async function sendWelcomeMessage(member) {
    try {
        const channel = await member.guild.channels.fetch('1542121319263641682').catch(() => null);
        if (!channel) return;

        // Wczytanie tła (lub awaryjne szare tło, gdyby link nie zadziałał)
        let background;
        try {
            background = await Jimp.read('https://i.imgur.com/jYhAJz6.png');
        } catch (e) {
            background = new Jimp(700, 250, '#2f3136');
        }
        background.resize(700, 250);

        // Wczytanie awatara użytkownika
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Jimp.read(avatarURL);
        avatar.resize(120, 120);

        // Załadowanie wbudowanych czcionek Jimp
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_GRAY);

        // Nałożenie awatara na pozycję x: 50, y: 65
        background.composite(avatar, 50, 65);

        // Teksty
        const title = `Witaj, ${member.user.username}!`;
        const subtitle = `Jesteś naszym ${member.guild.memberCount} użytkownikiem.`;

        background.print(font, 200, 80, title);
        background.print(smallFont, 200, 130, subtitle);

        const buffer = await background.getBufferAsync(Jimp.MIME_PNG);
        const attachment = new AttachmentBuilder(buffer, { name: 'welcome-banner.png' });

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
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

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

        // 1. Tworzenie płótna 1200x633 px
        const canvas = Canvas.createCanvas(1200, 633);
        const ctx = canvas.getContext('2d');

        // 2. Wczytanie i narysowanie tła z nowego linku
        const background = await Canvas.loadImage('https://iili.io/nqND2ls.png');
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // 3. Koordynaty awatara (środek koła X: 600, Y: 153)
        const centerX = 600;
        const centerY = 153;
        const avatarRadius = 104;

        // 4. Obramowanie pod awatarem
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarRadius + 6, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        // 5. Właściwy awatar użytkownika wycięty w koło
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatar = await Canvas.loadImage(avatarURL);
        ctx.drawImage(avatar, centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.restore();

        // 6. Rysowanie nazwy użytkownika (używamy DejaVu Sans, która zadziała po dodaniu Aptfile)
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 46px "DejaVu Sans", sans-serif';
        ctx.fillText(username, 606, 355);
        ctx.restore();

        // Generowanie załącznika i wysyłka
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-banner.png' });

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

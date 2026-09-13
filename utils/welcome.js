const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

let fontLoaded = false;

async function ensureFontLoaded() {
    if (fontLoaded) return;
    const fontPath = path.join(os.tmpdir(), 'Poppins-Bold.ttf');
    try {
        await fs.access(fontPath);
    } catch {
        try {
            const response = await fetch('https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf');
            if (!response.ok) throw new Error();
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(fontPath, buffer);
        } catch {
            return;
        }
    }
    try {
        Canvas.registerFont(fontPath, { family: 'Poppins', weight: 'bold' });
        fontLoaded = true;
    } catch (error) {
        console.error('Błąd rejestracji czcionki:', error);
    }
}

async function sendWelcomeMessage(member, mockData = null) {
    try {
        await ensureFontLoaded();

        const WELCOME_CHANNEL_ID = '1542121319263641682';
        const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        // Używamy danych testowych lub faktycznych danych użytkownika
        const avatarURL = mockData?.avatarURL || member.user.displayAvatarURL({ extension: 'png', size: 512 });
        const username = mockData?.username || member.user.username;
        const memberCount = member ? member.guild.memberCount : 100;
        const createdAt = member ? member.user.createdAt : new Date();
        const formattedDate = createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const serverName = member ? member.guild.name : 'Serwer Testowy';

        const canvas = Canvas.createCanvas(1200, 633);
        const ctx = canvas.getContext('2d');

        const background = await Canvas.loadImage('https://iili.io/nqND2ls.png').catch(() => null);
        if (!background) return;
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        const centerX = 600;
        const centerY = 153;
        const avatarRadius = 104;

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

        const avatar = await Canvas.loadImage(avatarURL).catch(() => null);
        if (avatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 46px "Poppins", sans-serif';
        ctx.fillText(username, 606, 355);
        ctx.restore();

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

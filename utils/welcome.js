const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendWelcomeMessage(member) {
    try {
        const WELCOME_CHANNEL_ID = '1542121319263641682';

        const channel = await member.guild.channels
            .fetch(WELCOME_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.error('❌ Nie znaleziono kanału powitalnego.');
            return;
        }

        const username = member.user.username;
        const serverName = member.guild.name;
        const memberCount = member.guild.memberCount;

        const formattedDate = member.user.createdAt
            .toISOString()
            .replace('T', ' ')
            .replace(/\..+/, '');

        const avatarURL = member.user.displayAvatarURL({
            extension: 'png',
            size: 512
        });

        // ==========================================
        // CANVAS
        // ==========================================

        const canvas = Canvas.createCanvas(1200, 633);
        const ctx = canvas.getContext('2d');

        // ==========================================
        // TŁO
        // ==========================================

        const background = await Canvas
            .loadImage('https://iili.io/nqND2ls.png')
            .catch((error) => {
                console.error('❌ Błąd ładowania tła:', error);
                return null;
            });

        if (!background) return;

        ctx.drawImage(
            background,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // ==========================================
        // AVATAR
        // ==========================================

        const avatarX = 600;
        const avatarY = 153;
        const avatarRadius = 104;

        ctx.save();

        ctx.beginPath();

        ctx.arc(
            avatarX,
            avatarY,
            avatarRadius + 6,
            0,
            Math.PI * 2
        );

        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.restore();

        // ==========================================
        // AVATAR UŻYTKOWNIKA
        // ==========================================

        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch((error) => {
                console.error('❌ Błąd ładowania avatara:', error);
                return null;
            });

        if (avatar) {
            ctx.save();

            ctx.beginPath();

            ctx.arc(
                avatarX,
                avatarY,
                avatarRadius,
                0,
                Math.PI * 2
            );

            ctx.closePath();

            ctx.clip();

            ctx.drawImage(
                avatar,
                avatarX - avatarRadius,
                avatarY - avatarRadius,
                avatarRadius * 2,
                avatarRadius * 2
            );

            ctx.restore();
        }

        // ==========================================
        // NAZWA UŻYTKOWNIKA
        // ==========================================

        const centerX = 600;

        // Tekst był trochę za wysoko,
        // więc przesuwamy go niżej.
        const textY = 390;

        // Większa czcionka
        let fontSize = 110;

        const maxWidth = 850;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ==========================================
        // DOBIERANIE ROZMIARU
        // ==========================================

        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

        let textWidth = ctx.measureText(username).width;

        // Jeżeli nick jest bardzo długi,
        // zmniejszamy czcionkę.
        while (textWidth > maxWidth && fontSize > 30) {
            fontSize -= 2;

            ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

            textWidth = ctx.measureText(username).width;
        }

        // ==========================================
        // RESET USTAWIEŃ
        // ==========================================

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // ==========================================
        // BIAŁY TEKST
        // ==========================================

        ctx.fillStyle = '#FFFFFF';

        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ==========================================
        // CZARNY CIEŃ
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;

        // ==========================================
        // RYSOWANIE TEKSTU
        // ==========================================

        ctx.fillText(
            username,
            centerX,
            textY
        );

        // ==========================================
        // DEBUG
        // ==========================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font:', ctx.font);
        console.log('📏 Text width:', textWidth);
        console.log('📍 X:', centerX);
        console.log('📍 Y:', textY);
        console.log('🎨 fillStyle:', ctx.fillStyle);
        console.log('======================================');

        // ==========================================
        // ZAŁĄCZNIK
        // ==========================================

        const attachment = new AttachmentBuilder(
            canvas.toBuffer('image/png'),
            {
                name: 'welcome-banner.png'
            }
        );

        // ==========================================
        // EMBED
        // ==========================================

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${username}\n\n` +
                `Cześć **${username}**! Witaj na **${serverName}**!\n` +
                `Jesteś naszym **${memberCount}** członkiem. Miłego pobytu!`
            )
            .setImage('attachment://welcome-banner.png')
            .setFooter({
                text: `Data utworzenia konta: ${formattedDate}`
            });

        // ==========================================
        // WYSYŁANIE
        // ==========================================

        await channel.send({
            embeds: [embed],
            files: [attachment]
        });

        console.log(
            `✅ Powitanie wysłane dla ${username}`
        );

    } catch (error) {
        console.error(
            '❌ Błąd podczas generowania powitania:',
            error
        );
    }
}

module.exports = {
    sendWelcomeMessage
};

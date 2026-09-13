const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendWelcomeMessage(member) {
    try {
        const WELCOME_CHANNEL_ID = '1542121319263641682';

        const channel = await member.guild.channels
            .fetch(WELCOME_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.error('Nie znaleziono kanału powitalnego.');
            return;
        }

        const memberCount = member.guild.memberCount;
        const username = member.user.username;
        const serverName = member.guild.name;

        const createdAt = member.user.createdAt;

        const formattedDate = createdAt
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '');

        // =========================================================
        // CANVAS
        // =========================================================

        const WIDTH = 1200;
        const HEIGHT = 633;

        const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');

        // Zawsze normalne nakładanie elementów
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // =========================================================
        // TŁO
        // =========================================================

        const background = await Canvas
            .loadImage('https://iili.io/nqND2ls.png')
            .catch(() => null);

        if (!background) {
            console.error('Nie udało się pobrać tła.');
            return;
        }

        ctx.drawImage(
            background,
            0,
            0,
            WIDTH,
            HEIGHT
        );

        // =========================================================
        // AVATAR
        // =========================================================

        const centerX = 600;
        const centerY = 153;
        const avatarRadius = 104;

        // Obramowanie avatara
        ctx.save();

        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
            avatarRadius + 6,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();

        // Avatar użytkownika
        const avatarURL = member.user.displayAvatarURL({
            extension: 'png',
            size: 512
        });

        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch(() => null);

        if (avatar) {
            ctx.save();

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                avatarRadius,
                0,
                Math.PI * 2
            );

            ctx.closePath();
            ctx.clip();

            ctx.drawImage(
                avatar,
                centerX - avatarRadius,
                centerY - avatarRadius,
                avatarRadius * 2,
                avatarRadius * 2
            );

            ctx.restore();
        }

        // =========================================================
        // NAZWA UŻYTKOWNIKA
        // =========================================================

        ctx.save();

        // Absolutny reset transformacji
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Normalne rysowanie
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Wyśrodkowanie tekstu
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // =========================================================
        // CZCIONKA
        // =========================================================

        let fontSize = 100;

        const maxTextWidth = 850;

        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

        // Dopasowanie bardzo długich nicków
        while (
            ctx.measureText(username).width > maxTextWidth &&
            fontSize > 45
        ) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px "DejaVu Sans"`;
        }

        // =========================================================
        // KOLOR
        // =========================================================

        ctx.fillStyle = 'rgba(255, 255, 255, 1)';

        // Brak obrysu
        ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = 0;

        // =========================================================
        // POZYCJA
        // =========================================================

        const textX = WIDTH / 2;

        // Celowo wyżej niż poprzednie 375
        const textY = 360;

        // =========================================================
        // TEKST
        // =========================================================

        ctx.fillText(
            username,
            textX,
            textY
        );

        ctx.restore();

        // =========================================================
        // DEBUG
        // =========================================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font:', `bold ${fontSize}px "DejaVu Sans"`);
        console.log(
            '📏 Text width:',
            ctx.measureText(username).width
        );
        console.log('📍 X:', textX);
        console.log('📍 Y:', textY);
        console.log('🎨 Kolor: #FFFFFF');
        console.log('🔄 Transform: 1, 0, 0, 1, 0, 0');
        console.log('======================================');

        // =========================================================
        // ZAŁĄCZNIK
        // =========================================================

        const attachment = new AttachmentBuilder(
            canvas.toBuffer('image/png'),
            {
                name: 'welcome-banner.png'
            }
        );

        // =========================================================
        // EMBED
        // =========================================================

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

        // =========================================================
        // WYSŁANIE
        // =========================================================

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

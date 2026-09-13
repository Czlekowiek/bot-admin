const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendWelcomeMessage(member) {
    try {
        const WELCOME_CHANNEL_ID = '1542121319263641682';

        // ==========================================
        // KANAŁ
        // ==========================================

        const channel = await member.guild.channels
            .fetch(WELCOME_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.error('❌ Nie znaleziono kanału powitalnego.');
            return;
        }

        // ==========================================
        // INFORMACJE
        // ==========================================

        const username = member.user.username;
        const serverName = member.guild.name;
        const memberCount = member.guild.memberCount;

        const createdAt = member.user.createdAt;

        const formattedDate = createdAt
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
                console.error('❌ Nie udało się pobrać tła:', error);
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

        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch((error) => {
                console.error('❌ Nie udało się pobrać avatara:', error);
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
        // USERNAME
        // ==========================================

        ctx.save();

        /*
         * Bazowy font 10px + skalowanie.
         *
         * Dzięki temu omijamy problem Render/node-canvas
         * z nieprawidłowym rozmiarem fontu.
         */

        const baseFontSize = 10;

        let targetFontSize = 80;

        const maxWidth = 850;

        ctx.font = `bold ${baseFontSize}px "DejaVu Sans"`;

        const baseTextWidth = ctx.measureText(username).width;

        let scale = targetFontSize / baseFontSize;

        let finalTextWidth = baseTextWidth * scale;

        // Automatyczne zmniejszanie bardzo długich nicków
        if (finalTextWidth > maxWidth) {
            scale = maxWidth / baseTextWidth;
            targetFontSize = baseFontSize * scale;
            finalTextWidth = maxWidth;
        }

        // ==========================================
        // POZYCJA TEKSTU
        // ==========================================

        const centerX = 600;

        /*
         * Było 355.
         *
         * Teraz przesuwamy tekst trochę NIŻEJ.
         * Możesz później zmienić na 365 / 375 / 385.
         */

        const textY = 375;

        const scaledCenterX = centerX / scale;
        const scaledTextY = textY / scale;

        // ==========================================
        // SKALOWANIE
        // ==========================================

        ctx.scale(scale, scale);

        // ==========================================
        // FONT
        // ==========================================

        ctx.font = `bold ${baseFontSize}px "DejaVu Sans"`;

        // ==========================================
        // CENTROWANIE
        // ==========================================

        const textX =
            scaledCenterX - (baseTextWidth / 2);

        // ==========================================
        // WAŻNE:
        // RESETUJEMY WSZYSTKO
        // ==========================================

        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation = 'source-over';

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // ==========================================
        // CZARNY OBRYS
        // ==========================================

        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.8;

        ctx.strokeStyle = '#000000';

        ctx.strokeText(
            username,
            textX,
            scaledTextY
        );

        // ==========================================
        // BIAŁE WYPEŁNIENIE
        // ==========================================

        ctx.fillStyle = '#FFFFFF';

        ctx.fillText(
            username,
            textX,
            scaledTextY
        );

        ctx.restore();

        // ==========================================
        // DEBUG
        // ==========================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('📏 Bazowa szerokość:', baseTextWidth);
        console.log('📏 Docelowa szerokość:', finalTextWidth);
        console.log('🔠 Docelowy rozmiar:', targetFontSize);
        console.log('🔎 Skala:', scale);
        console.log('📍 Środek X:', centerX);
        console.log('📍 Pozycja Y:', textY);
        console.log('🎨 Wypełnienie: #FFFFFF');
        console.log('🎨 Obramowanie: #000000');
        console.log('======================================');

        // ==========================================
        // PNG
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

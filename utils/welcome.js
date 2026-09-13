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

        if (!background) {
            return;
        }

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

        // Obramowanie avatara
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
        // AVATAR
        // ==========================================

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
        // NAZWA UŻYTKOWNIKA
        // ==========================================

        /*
         * WAŻNE:
         *
         * Nie polegamy tutaj na tym, że canvas poprawnie
         * interpretuje "80px".
         *
         * Używamy bazowej czcionki 10px i skalujemy
         * cały kontekst Canvas.
         *
         * Dzięki temu rozmiar tekstu jest wymuszony
         * przez transformację.
         */

        ctx.save();

        // Bazowy rozmiar fontu.
        // Na node-canvas 10px jest bezpiecznie interpretowane.
        const baseFontSize = 10;

        // Docelowy rozmiar tekstu
        let targetFontSize = 80;

        // Ustawiamy prosty font bez kombinowania
        ctx.font = `bold ${baseFontSize}px Arial`;

        // Szerokość tekstu przy 10px
        const baseTextWidth = ctx.measureText(username).width;

        // Maksymalna szerokość nicku
        const maxWidth = 850;

        // Wyliczamy skalę potrzebną do osiągnięcia 80px
        let scale = targetFontSize / baseFontSize;

        // Rzeczywista szerokość po przeskalowaniu
        let finalTextWidth = baseTextWidth * scale;

        // Jeśli nick jest zbyt długi,
        // zmniejszamy go automatycznie
        if (finalTextWidth > maxWidth) {
            scale = maxWidth / baseTextWidth;
            targetFontSize = baseFontSize * scale;
            finalTextWidth = maxWidth;
        }

        // ==========================================
        // POZYCJA
        // ==========================================

        const centerX = 600;
        const textY = 355;

        /*
         * Ponieważ skalujemy od punktu 0,0,
         * musimy podzielić pozycję X i Y przez skalę.
         */

        const scaledCenterX = centerX / scale;
        const scaledTextY = textY / scale;

        // ==========================================
        // SKALOWANIE
        // ==========================================

        ctx.scale(scale, scale);

        // ==========================================
        // KOLOR
        // ==========================================

        ctx.fillStyle = '#FFFFFF';

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // ==========================================
        // CIEŃ
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 1.5;
        ctx.shadowOffsetX = 0.5;
        ctx.shadowOffsetY = 0.5;

        // ==========================================
        // RĘCZNE CENTROWANIE
        // ==========================================

        const textX = scaledCenterX - (baseTextWidth / 2);

        // ==========================================
        // RYSOWANIE
        // ==========================================

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
        console.log('🎨 Kolor: #FFFFFF');
        console.log('======================================');

        // ==========================================
        // OBRAZ
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

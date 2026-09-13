const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendWelcomeMessage(member) {
    try {
        // ==========================================
        // USTAWIENIA
        // ==========================================

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
        // INFORMACJE O UŻYTKOWNIKU
        // ==========================================

        const memberCount = member.guild.memberCount;
        const username = member.user.username;
        const serverName = member.guild.name;

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
        // TWORZENIE CANVAS
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
            1200,
            633
        );

        // ==========================================
        // AVATAR
        // ==========================================

        const avatarCenterX = 600;
        const avatarCenterY = 153;
        const avatarRadius = 104;

        // Obramowanie avatara
        ctx.save();

        ctx.beginPath();

        ctx.arc(
            avatarCenterX,
            avatarCenterY,
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

        // Pobieranie avatara
        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch((error) => {
                console.error('❌ Nie udało się pobrać avatara:', error);
                return null;
            });

        // Rysowanie avatara
        if (avatar) {
            ctx.save();

            ctx.beginPath();

            ctx.arc(
                avatarCenterX,
                avatarCenterY,
                avatarRadius,
                0,
                Math.PI * 2
            );

            ctx.closePath();

            ctx.clip();

            ctx.drawImage(
                avatar,
                avatarCenterX - avatarRadius,
                avatarCenterY - avatarRadius,
                avatarRadius * 2,
                avatarRadius * 2
            );

            ctx.restore();
        }

        // ==========================================
        // NAZWA UŻYTKOWNIKA
        // ==========================================

        ctx.save();

        // Początkowy rozmiar tekstu
        let fontSize = 46;

        // Maksymalna szerokość nicku
        const maxTextWidth = 700;

        // Używamy zwykłego Arial.
        // Nie potrzebujemy żadnych dodatkowych fontów.
        ctx.font = `bold ${fontSize}px Arial`;

        // Sprawdzamy szerokość tekstu
        let textWidth = ctx.measureText(username).width;

        // Jeżeli nick jest za długi,
        // zmniejszamy czcionkę
        while (
            textWidth > maxTextWidth &&
            fontSize > 18
        ) {
            fontSize -= 2;

            ctx.font = `bold ${fontSize}px Arial`;

            textWidth = ctx.measureText(username).width;
        }

        // ==========================================
        // RĘCZNE CENTROWANIE
        // ==========================================

        // Środek banera to dokładnie X = 600
        const centerX = 600;

        // Pozycja Y tekstu
        const textY = 355;

        // Obliczamy początek tekstu.
        //
        // Przykład:
        // tekst ma 400px szerokości
        //
        // 600 - 200 = 400
        //
        // tekst zacznie się na X=400
        // i skończy na X=800
        //
        // dzięki temu środek będzie dokładnie na X=600.
        const textX = centerX - (textWidth / 2);

        // ==========================================
        // KOLOR TEKSTU
        // ==========================================

        ctx.fillStyle = '#FFFFFF';

        // ==========================================
        // CIEŃ
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // ==========================================
        // RYSOWANIE TEKSTU
        // ==========================================

        ctx.fillText(
            username,
            textX,
            textY
        );

        ctx.restore();

        // ==========================================
        // LOGI
        // ==========================================

        console.log('================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔤 Font:', `bold ${fontSize}px Arial`);
        console.log('📏 Text width:', textWidth);
        console.log('📍 Text X:', textX);
        console.log('📍 Text Y:', textY);
        console.log('🎯 Canvas center:', centerX);
        console.log('================================');

        // ==========================================
        // GENEROWANIE OBRAZU
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
            `✅ Wysłano wiadomość powitalną dla ${username}.`
        );

    } catch (error) {
        console.error(
            '❌ Błąd podczas generowania i wysyłania powitania:',
            error
        );
    }
}

module.exports = {
    sendWelcomeMessage
};

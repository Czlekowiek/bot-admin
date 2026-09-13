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
        // Jeżeli font już istnieje w pamięci tymczasowej Rendera,
        // nie pobieramy go ponownie.
        await fs.access(fontPath);
    } catch {
        try {
            console.log('📥 Pobieranie czcionki Poppins...');

            const response = await fetch(
                'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf'
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = Buffer.from(
                await response.arrayBuffer()
            );

            await fs.writeFile(fontPath, buffer);

            console.log('✅ Czcionka Poppins pobrana.');
        } catch (error) {
            console.error(
                '❌ Nie udało się pobrać czcionki Poppins:',
                error
            );

            return false;
        }
    }

    try {
        Canvas.registerFont(fontPath, {
            family: 'Poppins',
            weight: 'bold'
        });

        fontLoaded = true;

        console.log('✅ Czcionka Poppins została zarejestrowana.');

        return true;
    } catch (error) {
        console.error(
            '❌ Błąd rejestracji czcionki Poppins:',
            error
        );

        return false;
    }
}

async function sendWelcomeMessage(member) {
    try {
        // Czekamy aż font zostanie poprawnie załadowany
        await ensureFontLoaded();

        const WELCOME_CHANNEL_ID = '1542121319263641682';

        const channel = await member.guild.channels
            .fetch(WELCOME_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.error(
                '❌ Nie znaleziono kanału powitalnego.'
            );
            return;
        }

        const memberCount = member.guild.memberCount;
        const createdAt = member.user.createdAt;

        const formattedDate = createdAt
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '');

        const username = member.user.username;
        const serverName = member.guild.name;

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
                console.error(
                    '❌ Nie udało się pobrać tła:',
                    error
                );

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

        const centerX = 600;
        const centerY = 153;
        const avatarRadius = 104;

        // Obramowanie
        ctx.save();

        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
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

        // Avatar
        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch((error) => {
                console.error(
                    '❌ Nie udało się pobrać avatara:',
                    error
                );

                return null;
            });

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

        // ==========================================
        // NAZWA UŻYTKOWNIKA
        // ==========================================

        ctx.save();

        // Bardzo ważne ustawienia
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // BIAŁY kolor tekstu
        ctx.fillStyle = '#FFFFFF';

        let fontSize = 46;

        // Używamy Poppins
        ctx.font = `bold ${fontSize}px Poppins`;

        // Automatyczne zmniejszanie czcionki
        // przy długich nazwach
        while (
            ctx.measureText(username).width > 700 &&
            fontSize > 20
        ) {
            fontSize -= 2;

            ctx.font = `bold ${fontSize}px Poppins`;
        }

        // ==========================================
        // CIEŃ TEKSTU
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // ==========================================
        // TEKST
        // ==========================================

        ctx.fillText(
            username,
            600,
            355
        );

        ctx.restore();

        // ==========================================
        // DEBUG
        // ==========================================

        console.log('━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔤 Font:', ctx.font);
        console.log(
            '📏 Text width:',
            ctx.measureText(username).width
        );
        console.log('🎯 Text align:', ctx.textAlign);
        console.log('🎨 Fill style:', ctx.fillStyle);
        console.log('━━━━━━━━━━━━━━━━━━━━━━');

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

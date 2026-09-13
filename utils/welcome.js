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

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // =========================================================
        // TŁO
        // =========================================================

        const background = await Canvas
            .loadImage('https://iili.io/nqND2ls.png')
            .catch((error) => {
                console.error('❌ Błąd pobierania tła:', error);
                return null;
            });

        if (!background) {
            console.error('❌ Nie udało się pobrać tła.');
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

        // =========================================================
        // AVATAR UŻYTKOWNIKA
        // =========================================================

        const avatarURL = member.user.displayAvatarURL({
            extension: 'png',
            size: 512
        });

        const avatar = await Canvas
            .loadImage(avatarURL)
            .catch((error) => {
                console.error('❌ Błąd pobierania avatara:', error);
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
        } else {
            console.warn('⚠️ Nie udało się pobrać avatara.');
        }

        // =========================================================
        // TEKST - SVG
        // =========================================================
        //
        // NIE korzystamy tutaj z ctx.measureText().
        //
        // Dzięki SVG kolor i rozmiar tekstu są niezależne
        // od problematycznego renderowania tekstu przez canvas.
        // =========================================================

        const TEXT_Y = 380;
        const FONT_SIZE = 85;

        /*
         * Escape znaków specjalnych dla SVG.
         * Dzięki temu nick zawierający &, <, > itd. nie zepsuje SVG.
         */
        const escapeXml = (text) => {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const safeUsername = escapeXml(username);

        /*
         * SVG ma dokładnie taki sam rozmiar jak canvas.
         *
         * x="600" + text-anchor="middle"
         * = tekst idealnie na środku.
         *
         * fill="#FFFFFF"
         * = biały.
         *
         * font-weight="900"
         * = bardzo gruby.
         */
        const textSvg = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${WIDTH}"
    height="${HEIGHT}"
    viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
    <text
        x="600"
        y="${TEXT_Y}"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="#FFFFFF"
        fill-opacity="1"
        stroke="none"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="${FONT_SIZE}px"
        font-weight="900"
    >${safeUsername}</text>
</svg>
`;

        // =========================================================
        // ŁADOWANIE SVG
        // =========================================================

        const textImage = await Canvas
            .loadImage(
                Buffer.from(textSvg, 'utf8')
            )
            .catch((error) => {
                console.error('❌ Błąd renderowania SVG:', error);
                return null;
            });

        if (!textImage) {
            console.error('❌ Nie udało się utworzyć tekstu SVG.');
            return;
        }

        // =========================================================
        // WKLEJENIE TEKSTU
        // =========================================================

        ctx.save();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        ctx.drawImage(
            textImage,
            0,
            0,
            WIDTH,
            HEIGHT
        );

        ctx.restore();

        // =========================================================
        // DEBUG
        // =========================================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font: SVG DejaVu Sans');
        console.log('🔠 Font size:', FONT_SIZE);
        console.log('📍 X:', 600);
        console.log('📍 Y:', TEXT_Y);
        console.log('🎨 Kolor: #FFFFFF');
        console.log('💪 Font weight: 900');
        console.log('🖼️ Tło: OK');
        console.log('👤 Avatar:', avatar ? 'OK' : 'BRAK');
        console.log('======================================');

        // =========================================================
        // PNG
        // =========================================================

        const imageBuffer = canvas.toBuffer('image/png');

        const attachment = new AttachmentBuilder(
            imageBuffer,
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

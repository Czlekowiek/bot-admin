const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendLeaveMessage(member) {
    try {
        const LEAVE_CHANNEL_ID = '1542121319263641683';

        const channel = await member.guild.channels
            .fetch(LEAVE_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.error('❌ Nie znaleziono kanału pożegnań.');
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
            .loadImage('https://iili.io/nqeNgnV.png')
            .catch((error) => {
                console.error('❌ Błąd pobierania tła pożegnania:', error);
                return null;
            });

        if (!background) {
            console.error('❌ Nie udało się pobrać tła pożegnania.');
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

        const NORMAL_FONT_SIZE = 85;
        const MAX_TEXT_WIDTH = 850;
        const MIN_FONT_SIZE = 40;
        const NORMAL_TEXT_Y = 375;

        // =========================================================
        // AUTOMATYCZNE ZMNIEJSZANIE CZCIONKI
        // =========================================================

        const estimatedWidthAt85 = username.length * 48;

        let FONT_SIZE = NORMAL_FONT_SIZE;

        if (estimatedWidthAt85 > MAX_TEXT_WIDTH) {
            FONT_SIZE = Math.floor(
                NORMAL_FONT_SIZE *
                MAX_TEXT_WIDTH /
                estimatedWidthAt85
            );

            if (FONT_SIZE < MIN_FONT_SIZE) {
                FONT_SIZE = MIN_FONT_SIZE;
            }
        }

        // =========================================================
        // AUTOMATYCZNE PRZESUNIĘCIE DŁUGIEGO TEKSTU W GÓRĘ
        // =========================================================

        const sizeDifference =
            NORMAL_FONT_SIZE - FONT_SIZE;

        const TEXT_Y =
            NORMAL_TEXT_Y -
            Math.min(
                12,
                sizeDifference * 0.25
            ) - 2;

        // =========================================================
        // ESCAPE DLA SVG
        // =========================================================

        const escapeXml = (text) => {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const safeUsername = escapeXml(username);

        // =========================================================
        // SVG TEKSTU
        // =========================================================

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
                console.error(
                    '❌ Błąd renderowania SVG:',
                    error
                );
                return null;
            });

        if (!textImage) {
            console.error(
                '❌ Nie udało się utworzyć tekstu SVG.'
            );
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
        console.log('👋 LEAVE BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font: SVG DejaVu Sans');
        console.log('🔠 Font size:', FONT_SIZE);
        console.log('📏 Max text width:', MAX_TEXT_WIDTH);
        console.log('📍 X:', 600);
        console.log('📍 Y:', TEXT_Y);
        console.log('🎨 Kolor: #FFFFFF');
        console.log('💪 Font weight: 900');
        console.log('🖼️ Tło:', background ? 'OK' : 'BRAK');
        console.log('👤 Avatar:', avatar ? 'OK' : 'BRAK');
        console.log('======================================');

        // =========================================================
        // PNG
        // =========================================================

        const imageBuffer = canvas.toBuffer('image/png');

        const attachment = new AttachmentBuilder(
            imageBuffer,
            {
                name: 'leave-banner.png'
            }
        );

        // =========================================================
        // EMBED
        // =========================================================

        const displayName = member.displayName;

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${displayName}\n\n` +
                `Pa! **${displayName}** opuścił **${serverName}**, ` +
                `teraz mamy **${memberCount}** członków.`
            )
            .setImage('attachment://leave-banner.png')
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
            `👋 Pożegnanie wysłane dla ${username}`
        );

    } catch (error) {
        console.error(
            '❌ Błąd podczas generowania pożegnania:',
            error
        );
    }
}

module.exports = {
    sendLeaveMessage
};

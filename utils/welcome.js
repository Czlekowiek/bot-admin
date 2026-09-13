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
                console.error('❌ Nie udało się załadować tła:', error);
                return null;
            });

        if (!background) return;

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
                console.error('❌ Nie udało się załadować avatara:', error);
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

        // To możesz później zmienić,
        // jeżeli będziemy chcieli przesunąć tekst.
        const textY = 375;

        const maxWidth = 850;

        // Zaczynamy od 80 px
        let fontSize = 80;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ==========================================
        // DOBIERANIE ROZMIARU
        // ==========================================

        while (fontSize > 20) {
            ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

            const width = ctx.measureText(username).width;

            if (width <= maxWidth) {
                break;
            }

            fontSize -= 2;
        }

        const textWidth = ctx.measureText(username).width;

        // ==========================================
        // RESET CANVAS
        // ==========================================

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // ==========================================
        // BARDZO WAŻNE
        // ==========================================

        // NIE używamy ctx.scale()
        // NIE używamy transformacji
        // Kolor ustawiamy bezpośrednio przed fillText()

        ctx.fillStyle = 'rgb(255, 255, 255)';

        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ==========================================
        // DELIKATNY CZARNY CIEŃ
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;

        // ==========================================
        // BIAŁY TEKST
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
        console.log('🔄 transform: BRAK');
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
            '❌ Błąd podczas generowania i wysyłania powitania:',
            error
        );
    }
}

module.exports = {
    sendWelcomeMessage
};

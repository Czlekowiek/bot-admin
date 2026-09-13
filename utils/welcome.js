const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function sendWelcomeMessage(member) {
    try {
        const CHANNEL_ID = '1542121319263641682';

        const channel = await member.guild.channels.fetch(CHANNEL_ID).catch(() => null);

        if (!channel) {
            console.error('❌ Nie znaleziono kanału powitalnego.');
            return;
        }

        const username = member.user.username;
        const serverName = member.guild.name;
        const memberCount = member.guild.memberCount;

        // ==========================================
        // CANVAS
        // ==========================================

        const canvas = Canvas.createCanvas(1200, 633);
        const ctx = canvas.getContext('2d');

        // ==========================================
        // TŁO
        // ==========================================

        const background = await Canvas.loadImage(
            'https://iili.io/nqND2ls.png'
        );

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

        const avatarURL = member.user.displayAvatarURL({
            extension: 'png',
            size: 512
        });

        const avatar = await Canvas.loadImage(avatarURL).catch(() => null);

        const avatarX = 600;
        const avatarY = 153;
        const avatarRadius = 104;

        // Obramowanie
        ctx.save();

        ctx.beginPath();
        ctx.arc(
            avatarX,
            avatarY,
            avatarRadius + 7,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = '#000000';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.restore();

        // Avatar
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
         * Nie używamy:
         * - ctx.scale()
         * - transformacji
         * - ręcznego skalowania tekstu
         *
         * Canvas dostaje normalny font i normalny fillText().
         */

        const centerX = 600;
        const centerY = 390;

        let fontSize = 100;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Dobieramy rozmiar tylko na podstawie normalnego
        // measureText().
        ctx.font = `bold ${fontSize}px DejaVu Sans`;

        while (
            ctx.measureText(username).width > 850 &&
            fontSize > 30
        ) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px DejaVu Sans`;
        }

        // ==========================================
        // CZYSZCZENIE USTAWIEŃ
        // ==========================================

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // ==========================================
        // BIAŁY TEKST
        // ==========================================

        ctx.font = `bold ${fontSize}px DejaVu Sans`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Bardzo delikatny cień
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;

        // KLUCZOWE:
        // biały kolor ustawiamy bezpośrednio przed fillText
        ctx.fillStyle = 'white';

        ctx.fillText(
            username,
            centerX,
            centerY
        );

        // ==========================================
        // DEBUG
        // ==========================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font:', ctx.font);
        console.log('📏 Width:', ctx.measureText(username).width);
        console.log('📍 X:', centerX);
        console.log('📍 Y:', centerY);
        console.log('🎨 Color:', ctx.fillStyle);
        console.log('======================================');

        // ==========================================
        // PNG
        // ==========================================

        const buffer = canvas.toBuffer('image/png');

        const attachment = new AttachmentBuilder(
            buffer,
            {
                name: 'welcome-banner.png'
            }
        );

        // ==========================================
        // DATA KONTA
        // ==========================================

        const formattedDate = member.user.createdAt
            .toISOString()
            .replace('T', ' ')
            .replace(/\..+/, '');

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

        await channel.send({
            embeds: [embed],
            files: [attachment]
        });

        console.log(
            `✅ Powitanie wysłane dla ${username}`
        );

    } catch (error) {
        console.error(
            '❌ Błąd welcome:',
            error
        );
    }
}

module.exports = {
    sendWelcomeMessage
};

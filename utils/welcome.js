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

        /*
        ============================================================
        CANVAS
        ============================================================
        */

        const WIDTH = 1200;
        const HEIGHT = 633;

        const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');

        /*
        ============================================================
        TŁO
        ============================================================
        */

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

        /*
        ============================================================
        AWATAR
        ============================================================
        */

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

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();

        // Avatar
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

        /*
        ============================================================
        NAZWA UŻYTKOWNIKA
        ============================================================
        
        WAŻNE:
        Tekstu NIE rysujemy bezpośrednio na głównym canvasie.
        Tworzymy osobny canvas dla tekstu.
        ============================================================
        */

        const TEXT_CANVAS_WIDTH = 1000;
        const TEXT_CANVAS_HEIGHT = 150;

        const textCanvas = Canvas.createCanvas(
            TEXT_CANVAS_WIDTH,
            TEXT_CANVAS_HEIGHT
        );

        const textCtx = textCanvas.getContext('2d');

        // Absolutnie wyzeruj transformację
        textCtx.setTransform(1, 0, 0, 1, 0, 0);

        textCtx.textAlign = 'center';
        textCtx.textBaseline = 'middle';

        /*
        ------------------------------------------------------------
        FONT
        ------------------------------------------------------------
        */

        let fontSize = 100;

        textCtx.font = `bold ${fontSize}px DejaVu Sans`;

        /*
        ------------------------------------------------------------
        DOPASOWANIE DŁUGOŚCI NICKU
        ------------------------------------------------------------
        */

        const maxTextWidth = 850;

        while (
            textCtx.measureText(username).width > maxTextWidth &&
            fontSize > 40
        ) {
            fontSize -= 2;
            textCtx.font = `bold ${fontSize}px DejaVu Sans`;
        }

        /*
        ------------------------------------------------------------
        BIAŁY TEKST
        ------------------------------------------------------------
        */

        textCtx.globalAlpha = 1;

        // Bardzo ważne:
        textCtx.fillStyle = '#FFFFFF';
        textCtx.strokeStyle = 'transparent';

        /*
        ------------------------------------------------------------
        RYSOWANIE TEKSTU
        ------------------------------------------------------------
        */

        const textX = TEXT_CANVAS_WIDTH / 2;
        const textY = TEXT_CANVAS_HEIGHT / 2;

        textCtx.fillText(
            username,
            textX,
            textY
        );

        /*
        ============================================================
        WKLEJENIE GOTOWEGO TEKSTU NA BANER
        ============================================================
        
        Y = 375
        Możesz później zmienić tylko tę jedną wartość.
        ============================================================
        */

        const finalTextY = 375;

        ctx.drawImage(
            textCanvas,
            (WIDTH - TEXT_CANVAS_WIDTH) / 2,
            finalTextY - TEXT_CANVAS_HEIGHT / 2
        );

        /*
        ============================================================
        DEBUG
        ============================================================
        */

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔠 Font:', `bold ${fontSize}px DejaVu Sans`);
        console.log(
            '📏 Text width:',
            textCtx.measureText(username).width
        );
        console.log('📍 X:', WIDTH / 2);
        console.log('📍 Y:', finalTextY);
        console.log('🎨 Kolor: BIAŁY #FFFFFF');
        console.log('======================================');

        /*
        ============================================================
        ZAŁĄCZNIK
        ============================================================
        */

        const attachment = new AttachmentBuilder(
            canvas.toBuffer('image/png'),
            {
                name: 'welcome-banner.png'
            }
        );

        /*
        ============================================================
        EMBED
        ============================================================
        */

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
            '❌ Błąd podczas generowania powitania:',
            error
        );
    }
}

module.exports = {
    sendWelcomeMessage
};

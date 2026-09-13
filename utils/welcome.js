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

        ctx.save();

        ctx.beginPath();

        ctx.arc(
            avatarX,
            avatarY,
            avatarRadius + 6,
            0,
            Math.PI * 2
        );

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
        // TEKST USERNAME
        // ==========================================

        ctx.save();

        // Ustawiamy DUŻĄ czcionkę.
        // Używamy Liberation Sans, który instalujemy
        // przez Aptfile na Renderze.

        let fontSize = 80;
        const maxWidth = 850;

        ctx.font = `bold ${fontSize}px "Liberation Sans"`;

        // Prawdziwa wartość ustawionego fontu
        console.log('🔤 Canvas ctx.font:', ctx.font);

        let textWidth = ctx.measureText(username).width;

        console.log('📏 Początkowa szerokość:', textWidth);

        // Zmniejszanie tylko dla bardzo długich nicków
        while (
            textWidth > maxWidth &&
            fontSize > 30
        ) {
            fontSize -= 2;

            ctx.font = `bold ${fontSize}px "Liberation Sans"`;

            textWidth = ctx.measureText(username).width;
        }

        // ==========================================
        // RĘCZNE CENTROWANIE
        // ==========================================

        const centerX = 600;

        const textX = centerX - (textWidth / 2);

        const textY = 355;

        // ==========================================
        // BIAŁY KOLOR
        // ==========================================

        ctx.fillStyle = '#FFFFFF';

        // Usuwamy wszelkie ewentualne ustawienia
        // wpływające na kolor.

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // ==========================================
        // CIEŃ
        // ==========================================

        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // ==========================================
        // RYSOWANIE
        // ==========================================

        ctx.fillText(
            username,
            textX,
            textY
        );

        ctx.restore();

        // ==========================================
        // DEBUG
        // ==========================================

        console.log('======================================');
        console.log('🖼️ WELCOME BANNER');
        console.log('👤 Username:', username);
        console.log('🔤 RZECZYWISTY ctx.font:', ctx.font);
        console.log('📏 Text width:', textWidth);
        console.log('📍 Text X:', textX);
        console.log('📍 Text Y:', textY);
        console.log('🎨 Text color: #FFFFFF');
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

const { AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

async function generateBanner(member, backgroundUrl, type) {
    const WIDTH = 1200;
    const HEIGHT = 633;
    const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Tło
    const background = await Canvas.loadImage(backgroundUrl).catch(() => null);
    if (!background) throw new Error('Nie udało się pobrać tła.');
    ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);

    // Avatar
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatar = await Canvas.loadImage(avatarURL).catch(() => null);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(600, 153, 104, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 600 - 104, 153 - 104, 208, 208);
        ctx.restore();
    }

    // Tekst (SVG)
    const username = member.user.username;
    let fontSize = 85;
    const maxWidth = 850;
    const estimatedWidth = username.length * 48;

    if (estimatedWidth > maxWidth) {
        fontSize = Math.max(40, Math.floor(85 * maxWidth / estimatedWidth));
    }

    const textY = 375 - Math.min(12, (85 - fontSize) * 0.25) - 2;
    const safeUsername = username.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
        <text x="600" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}px" font-weight="900">${safeUsername}</text>
    </svg>`;

    const textImage = await Canvas.loadImage(Buffer.from(textSvg, 'utf8')).catch(() => null);
    if (!textImage) throw new Error('Nie udało się utworzyć tekstu SVG.');
    ctx.drawImage(textImage, 0, 0, WIDTH, HEIGHT);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `${type}-banner.png` });
}

module.exports = { generateBanner };

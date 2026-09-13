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
        // Sprawdzamy czy plik już istnieje
        await fs.access(fontPath);
    } catch {
        try {
            // Bezpieczne pobieranie z timeoutem / obsługą błędu sieciowego
            const response = await fetch('https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(fontPath, buffer);
        } catch (error) {
            console.error('Nie udało się pobrać czcionki Poppins, używam domyślnej:', error);
            return; // Jeśli pobieranie nie powiodło się, kod poleci na domyślnej czcionce bez wywalania bota
        }
    }

    try {
        Canvas.registerFont(fontPath, { family: 'Poppins', weight: 'bold' });
        fontLoaded = true;
    } catch (error) {
        console.error('Błąd rejestracji czcionki:', error);
    }
}

async function sendWelcomeMessage(member) {
    try {
        // Bezpieczne ładowanie czcionki w tle (nie blokuje i nie wywala aplikacji w razie bledu)
        await ensureFontLoaded();

        const WELCOME_CHANNEL_ID = '1542121319263641682';
        const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const memberCount = member.guild.memberCount;
        const createdAt = member.user.createdAt;
        const formattedDate = createdAt.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        let username = member.user.username;
        const serverName = member.guild.name;

        // 1. Tworzenie płótna 1200x633 px
        const canvas = Canvas.createCanvas(1200, 633);
        const ctx = canvas.getContext('2d');

        // 2. Wczytanie i narysowanie tła (zabezpieczenie przed błędem ładowania obrazka)
        const background = await Canvas.loadImage('https://iili.io/nqND2ls.png').catch(() => null);
        if (!background) {
            console.error('Nie udało się pobrać obrazka tła!');
            return;
        }
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // 3. Koordynaty awatara (środek koła X: 600, Y: 153)
        const centerX = 600;
        const centerY = 153;
        const avatarRadius = 104;

        // 4. Obramowanie pod awatarem
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarRadius + 6, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        // 5. Właściwy awatar użytkownika wycięty w koło
        const avatar = await Canvas.loadImage(avatarURL).catch(() => null);
        if (avatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
        }

        // 6. Rysowanie nazwy użytkownika z zabezpieczeniem przed zbyt długim nickiem
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        
        let fontSize = 46;
        ctx.font = `bold ${fontSize}px "Poppins", sans-serif`;
        
        // Jeśli nick jest za długi, automatycznie zmniejszamy czcionkę, żeby nie wychodził poza tło
        if (ctx.measureText(username).width > 700) {
            fontSize = 36;
            ctx.font = `bold ${fontSize}px "Poppins", sans-serif`;
        }

        ctx.fillText(username, 606, 355);
        ctx.restore();

        // Generowanie załącznika i wysyłka
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-banner.png' });

        const embed = new EmbedBuilder()
            .setColor(16764416)
            .setDescription(
                `### ${username}\n\n` +
                `Cześć **${username}**! Witaj na **${serverName}**!\n` +
                `Jesteś naszym **${memberCount}** członkiem. Miłego pobytu!`
            )
            .setImage('attachment://welcome-banner.png')
            .setFooter({ text: `Data utworzenia konta: ${formattedDate}` });

        await channel.send({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('Błąd podczas generowania i wysyłania powitania:', error);
    }
}

module.exports = { sendWelcomeMessage };

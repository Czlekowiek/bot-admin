const { AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');

async function generateBanner(member, backgroundUrl, type) {
    try {
        // Wczytanie tła (lub stworzenie zapasowego, gdyby link nie działał)
        let background;
        try {
            background = await Jimp.read(backgroundUrl);
        } catch (e) {
            background = new Jimp(700, 250, '#2f3136');
        }
        background.resize(700, 250);

        // Wczytanie awatara użytkownika
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Jimp.read(avatarURL);
        avatar.resize(120, 120);

        // Załadowanie wbudowanych czcionek Jimp
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_GRAY);

        // Nałożenie awatara na współrzędnych x: 50, y: 65
        background.composite(avatar, 50, 65);

        // Ustalenie tekstów w zależności od typu (welcome / leave)
        const title = type === 'welcome' 
            ? `Witaj, ${member.user.username}!` 
            : `Żegnaj, ${member.user.username}`;
            
        const subtitle = type === 'welcome' 
            ? `Jesteś naszym ${member.guild.memberCount} użytkownikiem.` 
            : `Szkoda, że odchodzisz.`;

        // Wpisanie tekstu na obrazek
        background.print(font, 200, 80, title);
        background.print(smallFont, 200, 130, subtitle);

        // Wygenerowanie pliku do wysłania na Discorda
        const buffer = await background.getBufferAsync(Jimp.MIME_PNG);
        const fileName = type === 'welcome' ? 'welcome-banner.png' : 'leave-banner.png';

        return new AttachmentBuilder(buffer, { name: fileName });
    } catch (error) {
        console.error('❌ Błąd podczas generowania banera przez Jimp:', error);
        throw error;
    }
}

module.exports = { generateBanner };
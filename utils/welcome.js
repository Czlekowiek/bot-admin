const { createCanvas, loadImage } = require("canvas");
const {
    AttachmentBuilder
} = require("discord.js");

async function createWelcomeBanner(member) {
    // =========================================================
    // USTAWIENIA
    // =========================================================

    const WIDTH = 1200;
    const HEIGHT = 500;

    // Tekst
    const FONT_SIZE = 90;
    const TEXT_Y = 360;

    // Kolor tekstu
    const TEXT_COLOR = "#FFFFFF";

    // Grubość obrysu
    const STROKE_WIDTH = 0;

    // =========================================================
    // TWORZENIE CANVASA
    // =========================================================

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // =========================================================
    // TŁO
    // =========================================================

    // Tutaj ustaw swoje tło.
    // Jeżeli masz obraz tła, podaj jego ścieżkę w loadImage().
    //
    // Na razie robimy przezroczyste tło, żeby Canvas
    // NIE dodawał czarnego kwadratu.

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // =========================================================
    // TEKST UŻYTKOWNIKA
    // =========================================================

    const username = member.user.username;

    // Ustawiamy font BEZ ŻADNEGO skalowania canvasu.
    ctx.font = `bold ${FONT_SIZE}px "DejaVu Sans"`;

    // Wyśrodkowanie
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Bardzo ważne:
    // resetujemy transformacje
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // =========================================================
    // RYSOWANIE TEKSTU
    // =========================================================

    ctx.fillStyle = TEXT_COLOR;

    if (STROKE_WIDTH > 0) {
        ctx.lineWidth = STROKE_WIDTH;
        ctx.strokeStyle = "#000000";
        ctx.strokeText(
            username,
            WIDTH / 2,
            TEXT_Y
        );
    }

    ctx.fillText(
        username,
        WIDTH / 2,
        TEXT_Y
    );

    // =========================================================
    // DEBUG
    // =========================================================

    console.log("======================================");
    console.log("🖼️ WELCOME BANNER");
    console.log("👤 Username:", username);
    console.log("🔠 Font:", ctx.font);
    console.log("📏 Text width:", ctx.measureText(username).width);
    console.log("📍 X:", WIDTH / 2);
    console.log("📍 Y:", TEXT_Y);
    console.log("🎨 Color:", ctx.fillStyle);
    console.log("🔄 Transform:", ctx.getTransform());
    console.log("======================================");

    // =========================================================
    // ZWRACAMY OBRAZ
    // =========================================================

    return canvas.toBuffer("image/png");
}

module.exports = {
    createWelcomeBanner
};

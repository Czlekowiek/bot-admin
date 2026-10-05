const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ChannelType
} = require('discord.js');

const KATEGORIA_ID = '1542126075512102922';
const PREFIX_KANALU = '┃・🤝・';

// Mapa zamiany liter na small caps (zgodnie z https://www.piliapp.com/cool-text/small-caps/)
const SMALL_CAPS_MAP = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ',
    'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ',
    'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'ą': 'ᴀ̨', 'ć': 'ᴄ́', 'ę': 'ᴇ̨', 'ł': 'ɬ', 'ń': 'ɴ́', 'ó': 'ᴏ́', 'ś': 'ꜱ́', 'ź': 'ʑ', 'ż': 'ʐ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ',
    'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ',
    'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ',
    'Ą': 'ᴀ̨', 'Ć': 'ᴄ́', 'Ę': 'ᴇ̨', 'Ł': 'ɬ', 'Ń': 'ɴ́', 'Ó': 'ᴏ́', 'Ś': 'ꜱ́', 'Ź': 'ʑ', 'Ż': 'ʐ'
};

/**
 * Zamienia tekst na small caps
 * Spacje zamienia na "᲼", reszta znaków zgodnie z mapą
 */
function zamienNaSmallCaps(tekst) {
    return [...tekst].map(char => {
        if (char === ' ') return '᲼';
        return SMALL_CAPS_MAP[char] ?? char;
    }).join('');
}

/**
 * Oblicza pozycję dla nowego kanału - w połowie kategorii (nie na górze, nie na dole)
 */
async function obliczPozycjeKanalu(kategoria) {
    const kanalyWKategorii = kategoria.children
        .filter(c => c.type === ChannelType.GuildText)
        .sort((a, b) => a.rawPosition - b.rawPosition);

    if (kanalyWKategorii.length === 0) {
        return 0;
    }

    const pozycja = Math.ceil(kanalyWKategorii.length / 2);
    return pozycja;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kanal-reklamy')
        .setDescription('Tworzy kanał reklamowy w kategorii reklam')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('modal_kanal_reklamy')
            .setTitle('Tworzenie kanału reklamowego');

        const nazwaInput = new TextInputBuilder()
            .setCustomId('kanal_nazwa')
            .setLabel('Nazwa kanału')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. testowy kanał')
            .setRequired(true)
            .setMaxLength(90);

        modal.addComponents(new ActionRowBuilder().addComponents(nazwaInput));

        await interaction.showModal(modal);
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== 'modal_kanal_reklamy') return;

            await interaction.deferReply({ ephemeral: true });

            try {
                const nazwaZModalu = interaction.fields.getTextInputValue('kanal_nazwa').trim();

                if (!nazwaZModalu) {
                    return interaction.editReply({ content: '❌ Nazwa kanału nie może być pusta!' });
                }

                const nazwaSmallCaps = zamienNaSmallCaps(nazwaZModalu);
                const pelnaNazwa = `${PREFIX_KANALU}${nazwaSmallCaps}`;

                if (pelnaNazwa.length > 100) {
                    return interaction.editReply({ 
                        content: `❌ Nazwa kanału po zamianie jest za długa (${pelnaNazwa.length}/100 znaków). Skróć nazwę we wpisie.` 
                    });
                }

                const kategoria = await interaction.guild.channels.fetch(KATEGORIA_ID).catch(() => null);
                
                if (!kategoria) {
                    return interaction.editReply({ content: '❌ Nie znaleziono kategorii o podanym ID!' });
                }

                if (kategoria.type !== ChannelType.GuildCategory) {
                    return interaction.editReply({ content: '❌ Podane ID nie należy do kategorii!' });
                }

                const pozycja = await obliczPozycjeKanalu(kategoria);

                const nowyKanal = await interaction.guild.channels.create({
                    name: pelnaNazwa,
                    type: ChannelType.GuildText,
                    parent: kategoria.id,
                    position: pozycja,
                    permissionOverwrites: []
                });

                try {
                    if (typeof client.sendLog === 'function') {
                        await client.sendLog(`<a:neon_staff:1550909470605844650> Użytkownik **${interaction.user.tag}** utworzył kanał reklamowy: **${pelnaNazwa}** (<#${nowyKanal.id}>) w kategorii <#${KATEGORIA_ID}>.`);
                    }
                } catch (err) {
                    console.error('Błąd logowania:', err);
                }

                return interaction.editReply({ 
                    content: `✅ Pomyślnie utworzono kanał reklamowy: **${pelnaNazwa}** (<#${nowyKanal.id}>)\nPozycja w kategorii: ${pozycja + 1} z ${kategoria.children.filter(c => c.type === ChannelType.GuildText).size + 1}` 
                });

            } catch (error) {
                console.error('Błąd przy tworzeniu kanału reklamowego:', error);
                return interaction.editReply({ 
                    content: `❌ Wystąpił błąd podczas tworzenia kanału: ${error.message}` 
                });
            }
        });
    }
};

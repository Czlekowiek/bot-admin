const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/frakcje_config.json');

// Domyślne frakcje zgodnie z wytycznymi
let FRAKCJE_DATA = {
    'kgp': {
        skrot: 'kgp',
        pelnaNazwa: 'Komenda Główna Policji',
        nazwaPrzycisku: 'KGP',
        tekstLinijka: 'Komenda Główna Policji',
        discord: 'https://discord.gg/twoj-link-kgp',
        podanie: 'https://forms.gle/twoj-link-podanie-kgp'
    },
    'prm': {
        skrot: 'prm',
        pelnaNazwa: 'Państwowe Ratownictwo Medyczne',
        nazwaPrzycisku: 'PRM',
        tekstLinijka: 'Państwowe Ratownictwo Medyczne',
        discord: 'https://discord.gg/twoj-link-prm',
        podanie: 'https://forms.gle/twoj-link-podanie-prm'
    },
    'osp': {
        skrot: 'osp',
        pelnaNazwa: 'Ochotnicza Straż Pożarna',
        nazwaPrzycisku: 'OSP',
        tekstLinijka: 'Ochotnicza Straż Pożarna',
        discord: 'https://discord.gg/twoj-link-osp',
        podanie: 'https://forms.gle/twoj-link-podanie-osp'
    },
    'itd': {
        skrot: 'itd',
        pelnaNazwa: 'Inspekcja Transportu Drogowego',
        nazwaPrzycisku: 'ITD',
        tekstLinijka: 'Inspekcja Transportu Drogowego',
        discord: 'https://discord.gg/twoj-link-itd',
        podanie: 'https://forms.gle/twoj-link-podanie-itd'
    },
    'pr': {
        skrot: 'pr',
        pelnaNazwa: 'Prokuratura Rejonowa',
        nazwaPrzycisku: 'PR',
        tekstLinijka: 'Prokuratura Rejonowa',
        discord: 'https://discord.gg/twoj-link-pr',
        podanie: 'https://forms.gle/twoj-link-podanie-pr'
    }
};

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(data);
            FRAKCJE_DATA = { ...FRAKCJE_DATA, ...parsed };
        } else {
            saveConfig();
        }
    } catch (e) {
        console.error('Błąd wczytywania konfiguracji frakcji:', e);
    }
}

function saveConfig() {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(FRAKCJE_DATA, null, 2), 'utf8');
    } catch (e) {
        console.error('Błąd zapisu konfiguracji frakcji:', e);
    }
}

loadConfig();

// Funkcja budująca dynamiczny embed i przyciski panelu gracza
function buildUserPanel() {
    let description = 
        `## <:googleform:1553818167753572362> PANEL PODAŃ DO FRAKCJI\n` +
        `## <a:dot:1543969325155745812> Wybierz frakcję, do której chcesz złożyć podanie. Po kliknięciu bot wyśle wiadomość z linkiem do serwera Discord oraz link do podania wybranej frakcji.\n` +
;

    const buttons = [];

    for (const [key, data] of Object.entries(FRAKCJE_DATA)) {
        description += `\n### <a:dot:1543969325155745812> ${data.tekstLinijka}\n<:arrow:1543977081233342494> Kliknij przycisk ${data.nazwaPrzycisku}, aby otrzymać linki.`;
        
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`podanie_${key}`)
                .setLabel(data.nazwaPrzycisku)
                .setStyle(ButtonStyle.Primary)
        );
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFCE00)
        .setDescription(description);

    // Dzielenie przycisków na rzędy (maksymalnie 5 w rzędzie)
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        const chunk = buttons.slice(i, i + 5);
        rows.push(new ActionRowBuilder().addComponents(chunk));
    }

    return { embeds: [embed], components: rows };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('podania')
        .setDescription('Zarządzanie systemem podań do frakcji')
        .addSubcommand(subcommand =>
            subcommand
                .setName('wyslij-panel')
                .setDescription('Wysyła publiczny panel podań dla graczy')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('wyslij-panel-zarzadzanie')
                .setDescription('Wysyła panel zarządzania linkami i frakcjami dla administracji')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'wyslij-panel') {
            await interaction.deferReply({ ephemeral: true });
            const panel = buildUserPanel();
            await interaction.channel.send(panel);
            return interaction.editReply({ content: '✅ Pomyślnie wysłano publiczny panel podań na ten kanał!' });
        }

        if (subcommand === 'wyslij-panel-zarzadzanie') {
            await interaction.deferReply({ ephemeral: true });

            const adminEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🛠️ · PANEL ZARZĄDZANIA FRAKCJAMI')
                .setDescription(
                    `Witaj w panelu administracyjnym.\n\n` +
                    `> Kliknij przycisk wybranej frakcji poniżej, aby edytować jej linki, lub użyj przycisków na samym dole, aby **dodać** lub **usunąć** frakcję z listy.`
                );

            const buttons = [];
            for (const [key, data] of Object.entries(FRAKCJE_DATA)) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`admin_edit_${key}`)
                        .setLabel(`Edytuj ${data.nazwaPrzycisku}`)
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            // Rząd z przyciskami Dodaj / Usuń frakcję (inne kolory)
            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_add_faction').setLabel('➕ Dodaj frakcję').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('admin_remove_faction').setLabel('➖ Usuń frakcję').setStyle(ButtonStyle.Danger)
            );
            rows.push(controlRow);

            await interaction.channel.send({ embeds: [adminEmbed], components: rows });
            return interaction.editReply({ content: '✅ Pomyślnie wysłano panel zarządzania na ten kanał!' });
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            // 1. Kliknięcie przez gracza (wysyłanie widocznych tylko dla niego linków na kanale)
            if (interaction.isButton() && interaction.customId.startsWith('podanie_')) {
                const frakcjaKey = interaction.customId.replace('podanie_', '');
                const dane = FRAKCJE_DATA[frakcjaKey];

                if (!dane) {
                    return interaction.reply({ content: '❌ Ta frakcja nie istnieje lub została usunięta.', ephemeral: true });
                }

                const wiadomosc = 
                    `## <:Discord:1544052630144286812> Serwer Discord (${dane.pelnaNazwa})\n` +
                    `<:arrow:1543977081233342494> ${dane.discord}\n\n` +
                    `## <:googleform:1553818167753572362> Podanie\n` +
                    `<:arrow:1543977081233342494> ${dane.podanie}`;

                return interaction.reply({ content: wiadomosc, ephemeral: true });
            }

            // 2. Kliknięcie edycji frakcji przez administratora
            if (interaction.isButton() && interaction.customId.startsWith('admin_edit_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                }

                const frakcjaKey = interaction.customId.replace('admin_edit_', '');
                const dane = FRAKCJE_DATA[frakcjaKey];

                const modal = new ModalBuilder()
                    .setCustomId(`modal_edit_${frakcjaKey}`)
                    .setTitle(`Edycja: ${dane.nazwaPrzycisku}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('edit_discord').setLabel('Link do Discorda').setStyle(TextInputStyle.Short).setValue(dane.discord).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('edit_podanie').setLabel('Link do podania').setStyle(TextInputStyle.Short).setValue(dane.podanie).setRequired(true)
                    )
                );

                return await interaction.showModal(modal);
            }

            // 3. Kliknięcie "Dodaj frakcję"
            if (interaction.isButton() && interaction.customId === 'admin_add_faction') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('modal_add_faction')
                    .setTitle('Dodawanie nowej frakcji');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_skrot').setLabel('Skrót (np. sapd)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_pelna').setLabel('Pełna nazwa frakcji').setStyle(TextInputStyle.Short).setRequired(true)),
                    newActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_przycisk').setLabel('Nazwa na przycisku (np. SAPD)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_discord').setLabel('Link Discord').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_podanie').setLabel('Link do podania').setStyle(TextInputStyle.Short).setRequired(true))
                );

                return await interaction.showModal(modal);
            }

            // 4. Kliknięcie "Usuń frakcję"
            if (interaction.isButton() && interaction.customId === 'admin_remove_faction') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('modal_remove_faction')
                    .setTitle('Usuwanie frakcji');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('remove_skrot').setLabel('Wpisz skrót frakcji do usunięcia (np. osp)').setStyle(TextInputStyle.Short).setRequired(true)
                    )
                );

                return await interaction.showModal(modal);
            }

            // 5. Obsługa przesłania modali przez administrację
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_edit_')) {
                    const key = interaction.customId.replace('modal_edit_', '');
                    if (FRAKCJE_DATA[key]) {
                        FRAKCJE_DATA[key].discord = interaction.fields.getTextInputValue('edit_discord');
                        FRAKCJE_DATA[key].podanie = interaction.fields.getTextInputValue('edit_podanie');
                        saveConfig();
                    }
                    return interaction.reply({ content: '✅ Zaktualizowano linki!', ephemeral: true });
                }

                if (interaction.customId === 'modal_add_faction') {
                    const skrot = interaction.fields.getTextInputValue('add_skrot').toLowerCase().trim();
                    const pelna = interaction.fields.getTextInputValue('add_pelna').trim();
                    const przycisk = interaction.fields.getTextInputValue('add_przycisk').trim();
                    const discord = interaction.fields.getTextInputValue('add_discord').trim();
                    const podanie = interaction.fields.getTextInputValue('add_podanie').trim();

                    FRAKCJE_DATA[skrot] = {
                        skrot: skrot,
                        pelnaNazwa: pelna,
                        nazwaPrzycisku: przycisk,
                        tekstLinijka: pelna,
                        discord: discord,
                        podanie: podanie
                    };
                    saveConfig();

                    return interaction.reply({ content: `✅ Pomyślnie dodano frakcję **${przycisk}**!`, ephemeral: true });
                }

                if (interaction.customId === 'modal_remove_faction') {
                    const skrot = interaction.fields.getTextInputValue('remove_skrot').toLowerCase().trim();

                    if (FRAKCJE_DATA[skrot]) {
                        delete FRAKCJE_DATA[skrot];
                        saveConfig();
                        return interaction.reply({ content: `✅ Pomyślnie usunięto frakcję o skrócie **${skrot}**!`, ephemeral: true });
                    } else {
                        return interaction.reply({ content: `❌ Nie znaleziono frakcji o takim skrócie!`, ephemeral: true });
                    }
                }
            }
        });
    }
};

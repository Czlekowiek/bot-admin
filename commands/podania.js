const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ścieżka do pliku konfiguracyjnego, aby linki zapisywały się na stałe
const configPath = path.join(__dirname, '../data/frakcje_config.json');

// Domyślne dane frakcji (jeśli plik jeszcze nie istnieje)
let FRAKCJE_DATA = {
    'kgp': {
        nazwa: 'KGP (Komenda Główna Policji)',
        discord: 'https://discord.gg/twoj-link-kgp',
        podanie: 'https://forms.gle/twoj-link-podanie-kgp'
    },
    'prm': {
        nazwa: 'PRM (Państwowe Ratownictwo Medyczne)',
        discord: 'https://discord.gg/twoj-link-prm',
        podanie: 'https://forms.gle/twoj-link-podanie-prm'
    },
    'gddkia': {
        nazwa: 'GDDKiA (Generalna Dyrekcja Dróg Krajowych i Autostrad)',
        discord: 'https://discord.gg/twoj-link-gddkia',
        podanie: 'https://forms.gle/twoj-link-podanie-gddkia'
    },
    'administracja': {
        nazwa: 'Administracja Serwera',
        discord: 'https://discord.gg/twoj-link-admin',
        podanie: 'https://forms.gle/twoj-link-podanie-admin'
    },
    'osp': {
        nazwa: 'OSP (Ochotnicza Straż Pożarna)',
        discord: 'https://discord.gg/twoj-link-osp',
        podanie: 'https://forms.gle/twoj-link-podanie-osp'
    },
    'psp': {
        nazwa: 'PSP (Państwowa Straż Pożarna)',
        discord: 'https://discord.gg/twoj-link-psp',
        podanie: 'https://forms.gle/twoj-link-podanie-psp'
    }
};

// Funkcja ładowania danych z pliku (jeśli istnieje)
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

// Funkcja zapisu danych do pliku
function saveConfig() {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(FRAKCJE_DATA, null, 2), 'utf8');
    } catch (e) {
        console.error('Błąd zapisu konfiguracji frakcji:', e);
    }
}

// Załaduj konfigurację przy starcie
loadConfig();

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
                .setDescription('Wysyła panel zarządzania linkami dla administracji')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'wyslij-panel') {
            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(0xFFCE00)
                .setTitle('📧 · PANEL PODAŃ DO FRAKCJI')
                .setDescription(
                    `Wybierz frakcję, do której chcesz złożyć podanie.\n\n` +
                    `> Po kliknięciu bot wyśle w prywatnej wiadomości (DM) **link do serwera Discord** oraz **link do podania** wybranej frakcji.\n` +
                    `> \n> 📝 **Ważne:** Odpowiadaj szczerze i nie pośpieszaj administracji ani zarządu frakcji ze sprawdzeniem.\n\n` +
                    `----------------------------------------\n` +
                    `👮‍♂️ **KGP**\nKliknij przycisk **KGP**, aby otrzymać linki.\n\n` +
                    `🚑 **PRM**\nKliknij przycisk **PRM**, aby otrzymać linki.\n\n` +
                    `🛣️ **GDDKiA**\nKliknij przycisk **GDDKiA**, aby otrzymać linki.\n\n` +
                    `🛡️ **Administracja**\nKliknij przycisk **Administracja**, aby otrzymać linki.\n\n` +
                    `🔥 **OSP**\nKliknij przycisk **OSP**, aby otrzymać linki.\n\n` +
                    `🚒 **PSP**\nKliknij przycisk **PSP**, aby otrzymać linki.`
                )
                .setFooter({ text: 'Warszawska Polana RP • System podań • PODANIA_PANEL' });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('podanie_kgp').setLabel('KGP').setStyle(ButtonStyle.Primary).setEmoji('👮‍♂️'),
                new ButtonBuilder().setCustomId('podanie_prm').setLabel('PRM').setStyle(ButtonStyle.Primary).setEmoji('🚑'),
                new ButtonBuilder().setCustomId('podanie_gddkia').setLabel('GDDKiA').setStyle(ButtonStyle.Primary).setEmoji('🛣️'),
                new ButtonBuilder().setCustomId('podanie_administracja').setLabel('Administracja').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('podanie_osp').setLabel('OSP').setStyle(ButtonStyle.Primary).setEmoji('🔥'),
                new ButtonBuilder().setCustomId('podanie_psp').setLabel('PSP').setStyle(ButtonStyle.Primary).setEmoji('🚒')
            );

            await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
            return interaction.editReply({ content: '✅ Pomyślnie wysłano publiczny panel podań na ten kanał!' });
        }

        if (subcommand === 'wyslij-panel-zarzadzanie') {
            await interaction.deferReply({ ephemeral: true });

            const adminEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🛠️ · PANEL ZARZĄDZANIA LINKAMI FRAKCJI')
                .setDescription(
                    `Witaj w panelu administracyjnym systemów podań.\n\n` +
                    `> Kliknij przycisk wybranej frakcji poniżej, aby otworzyć formularz (modal) i **zaktualizować link do serwera Discord** oraz **link do podania (Google Forms)**.\n` +
                    `> Zmiany natychmiast zaczną obowiązywać dla graczy klikających przyciski w głównym panelu!`
                )
                .setFooter({ text: 'Warszawska Polana RP • Panel Zarządzania' });

            const adminRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_edit_kgp').setLabel('Edytuj KGP').setStyle(ButtonStyle.Danger).setEmoji('👮‍♂️'),
                new ButtonBuilder().setCustomId('admin_edit_prm').setLabel('Edytuj PRM').setStyle(ButtonStyle.Danger).setEmoji('🚑'),
                new ButtonBuilder().setCustomId('admin_edit_gddkia').setLabel('Edytuj GDDKiA').setStyle(ButtonStyle.Danger).setEmoji('🛣️'),
                new ButtonBuilder().setCustomId('admin_edit_administracja').setLabel('Edytuj Administrację').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
            );

            const adminRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_edit_osp').setLabel('Edytuj OSP').setStyle(ButtonStyle.Danger).setEmoji('🔥'),
                new ButtonBuilder().setCustomId('admin_edit_psp').setLabel('Edytuj PSP').setStyle(ButtonStyle.Danger).setEmoji('🚒')
            );

            await interaction.channel.send({ embeds: [adminEmbed], components: [adminRow1, adminRow2] });
            return interaction.editReply({ content: '✅ Pomyślnie wysłano panel zarządzania linkami na ten kanał!' });
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            // 1. Obsługa kliknięcia przez gracza (wysyłanie linków w DM)
            if (interaction.isButton() && interaction.customId.startsWith('podanie_')) {
                const frakcjaKey = interaction.customId.replace('podanie_', '');
                const dane = FRAKCJE_DATA[frakcjaKey];

                if (!dane) {
                    return interaction.reply({ content: '❌ Nie znaleziono danych dla tej frakcji.', ephemeral: true });
                }

                const wiadomoscPrywatna = 
                    `## <:Discord:1544052630144286812> Serwer Discord (${dane.nazwa})\n` +
                    `<:arrow:1543977081233342494> ${dane.discord}\n\n` +
                    `## <:googleform:1553818167753572362> Podanie\n` +
                    `<:arrow:1543977081233342494> ${dane.podanie}`;

                try {
                    await interaction.user.send({ content: wiadomoscPrywatna });
                    return interaction.reply({ content: '✅ Wysłano linki w wiadomości prywatnej (sprawdź DM)!', ephemeral: true });
                } catch (error) {
                    return interaction.reply({ 
                        content: '❌ Nie mogłem wysłać do Ciebie wiadomości prywatnej (DM). Upewnij się, że masz odblokowane wiadomości od osób z serwera!\n\n' +
                                 'Oto Twoje linki:\n' + wiadomoscPrywatna, 
                        ephemeral: true 
                    });
                }
            }

            // 2. Obsługa kliknięcia przez administratora (otwarcie modala edycji)
            if (interaction.isButton() && interaction.customId.startsWith('admin_edit_')) {
                // Sprawdzenie czy użytkownik ma uprawnienia administratora
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Nie masz uprawnień do korzystania z tego panelu!', ephemeral: true });
                }

                const frakcjaKey = interaction.customId.replace('admin_edit_', '');
                const dane = FRAKCJE_DATA[frakcjaKey];

                const modal = new ModalBuilder()
                    .setCustomId(`modal_edit_frakcja_${frakcjaKey}`)
                    .setTitle(`Edycja linków: ${dane.nazwa.substring(0, 20)}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('edit_discord')
                            .setLabel('Link do serwera Discord')
                            .setStyle(TextInputStyle.Short)
                            .setValue(dane.discord)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('edit_podanie')
                            .setLabel('Link do podania (Google Form)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(dane.podanie)
                            .setRequired(true)
                    )
                );

                return await interaction.showModal(modal);
            }

            // 3. Obsługa przesłania modala edycji przez administratora
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_edit_frakcja_')) {
                const frakcjaKey = interaction.customId.replace('modal_edit_frakcja_', '');
                
                const nowyDiscord = interaction.fields.getTextInputValue('edit_discord');
                const nowePodanie = interaction.fields.getTextInputValue('edit_podanie');

                if (FRAKCJE_DATA[frakcjaKey]) {
                    FRAKCJE_DATA[frakcjaKey].discord = nowyDiscord;
                    FRAKCJE_DATA[frakcjaKey].podanie = nowePodanie;
                    saveConfig(); // Zapisujemy zmiany na stałe w pliku JSON
                }

                return interaction.reply({ 
                    content: `✅ Pomyślnie zaktualizowano linki dla frakcji **${FRAKCJE_DATA[frakcjaKey].nazwa}**!`, 
                    ephemeral: true 
                });
            }
        });
    }
};

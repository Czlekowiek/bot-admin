const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getDb } = require('../index');

// Domyślna konfiguracja startowa, jeśli baza jest pusta
const DEFAULT_FRAKCJE = {
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

// Funkcje pomocnicze do pobierania i zapisu konfiguracji w MongoDB
async function getConfig() {
    const db = getDb();
    if (!db) return { panele: { gracz: [], admin: [] }, frakcje: DEFAULT_FRAKCJE };

    const collection = db.collection('settings');
    let configDoc = await collection.findOne({ _id: 'podania_config' });

    if (!configDoc) {
        configDoc = {
            _id: 'podania_config',
            panele: { gracz: [], admin: [] },
            frakcje: DEFAULT_FRAKCJE
        };
        await collection.insertOne(configDoc);
    }
    return configDoc;
}

async function saveConfigToDb(configData) {
    const db = getDb();
    if (!db) return;

    const collection = db.collection('settings');
    await collection.updateOne(
        { _id: 'podania_config' },
        { $set: { panele: configData.panele, frakcje: configData.frakcje } },
        { upsert: true }
    );
}

// Funkcja budująca publiczny panel gracza
function buildUserPanel(frakcje) {
    let description = 
        `## <:googleform:1553818167753572362> PANEL PODAŃ DO FRAKCJI\n` +
        `## <a:dot:1543969325155745812> Wybierz frakcję, do której chcesz złożyć podanie. Po kliknięciu bot wyśle wiadomość z linkiem do serwera Discord oraz link do podania wybranej frakcji.`;

    const buttons = [];

    for (const [key, data] of Object.entries(frakcje)) {
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

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    return { embeds: [embed], components: rows };
}

// Funkcja budująca panel administracyjny
function buildAdminPanel(frakcje) {
    const adminEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🛠️ · PANEL ZARZĄDZANIA FRAKCJAMI')
        .setDescription(
            `Witaj w panelu administracyjnym.\n\n` +
            `> Kliknij przycisk wybranej frakcji poniżej, aby edytować jej linki, lub użyj przycisków na samym dole, aby **dodać** lub **usunąć** frakcję z listy.`
        );

    const buttons = [];
    for (const [key, data] of Object.entries(frakcje)) {
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

    const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_faction').setLabel('➕ Dodaj frakcję').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('admin_remove_faction').setLabel('➖ Usuń frakcję').setStyle(ButtonStyle.Danger)
    );
    rows.push(controlRow);

    return { embeds: [adminEmbed], components: rows };
}

// Funkcja automatycznie aktualizująca wszystkie wysłane aktywne panele na serwerze
async function updateAllPanels(client) {
    const CONFIG = await getConfig();

    for (let i = CONFIG.panele.gracz.length - 1; i >= 0; i--) {
        const p = CONFIG.panele.gracz[i];
        try {
            const channel = await client.channels.fetch(p.channelId).catch(() => null);
            if (!channel) { CONFIG.panele.gracz.splice(i, 1); continue; }
            const msg = await channel.messages.fetch(p.messageId).catch(() => null);
            if (!msg) { CONFIG.panele.gracz.splice(i, 1); continue; }
            await msg.edit(buildUserPanel(CONFIG.frakcje));
        } catch (e) {
            console.error('Błąd aktualizacji panelu gracza:', e);
        }
    }

    for (let i = CONFIG.panele.admin.length - 1; i >= 0; i--) {
        const p = CONFIG.panele.admin[i];
        try {
            const channel = await client.channels.fetch(p.channelId).catch(() => null);
            if (!channel) { CONFIG.panele.admin.splice(i, 1); continue; }
            const msg = await channel.messages.fetch(p.messageId).catch(() => null);
            if (!msg) { CONFIG.panele.admin.splice(i, 1); continue; }
            await msg.edit(buildAdminPanel(CONFIG.frakcje));
        } catch (e) {
            console.error('Błąd aktualizacji panelu admina:', e);
        }
    }

    await saveConfigToDb(CONFIG);
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
        .addSubcommand(subcommand =>
            subcommand
                .setName('lista')
                .setDescription('Wyświetla listę wszystkich skonfigurowanych frakcji wraz z linkami i szczegółami')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const CONFIG = await getConfig();

        if (subcommand === 'wyslij-panel') {
            await interaction.deferReply({ ephemeral: true });
            const msg = await interaction.channel.send(buildUserPanel(CONFIG.frakcje));
            
            CONFIG.panele.gracz.push({ channelId: interaction.channelId, messageId: msg.id });
            await saveConfigToDb(CONFIG);

            return interaction.editReply({ content: '✅ Pomyślnie wysłano publiczny panel podań na ten kanał! Będzie się on automatycznie aktualizował.' });
        }

        if (subcommand === 'wyslij-panel-zarzadzanie') {
            await interaction.deferReply({ ephemeral: true });
            const msg = await interaction.channel.send(buildAdminPanel(CONFIG.frakcje));
            
            CONFIG.panele.admin.push({ channelId: interaction.channelId, messageId: msg.id });
            await saveConfigToDb(CONFIG);

            return interaction.editReply({ content: '✅ Pomyślnie wysłano panel zarządzania na ten kanał! Będzie się on automatycznie aktualizował.' });
        }

        if (subcommand === 'lista') {
            await interaction.deferReply({ ephemeral: true });

            const frakcjeEntries = Object.entries(CONFIG.frakcje);

            if (frakcjeEntries.length === 0) {
                return interaction.editReply({ content: '❌ Brak skonfigurowanych frakcji w bazie.' });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00AEFF)
                .setTitle('📋 · LISTA SKONFIGUROWANYCH FRAKCJI')
                .setDescription(`Poniżej znajduje się zestawienie wszystkich aktualnych frakcji w systemie:`);

            for (const [key, data] of frakcjeEntries) {
                embed.addFields({
                    name: `🔹 ${data.pelnaNazwa} (${data.nazwaPrzycisku})`,
                    value: `> **Skrót (klucz):** \`${data.skrot}\`\n` +
                           `> **Discord:** [Kliknij tutaj](${data.discord})\n` +
                           `> **Podanie:** [Kliknij tutaj](${data.podanie})`,
                    inline: false
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            const CONFIG = await getConfig();

            if (interaction.isButton() && interaction.customId.startsWith('podanie_')) {
                const frakcjaKey = interaction.customId.replace('podanie_', '');
                const dane = CONFIG.frakcje[frakcjaKey];

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

            if (interaction.isButton() && interaction.customId.startsWith('admin_edit_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                }

                const frakcjaKey = interaction.customId.replace('admin_edit_', '');
                const dane = CONFIG.frakcje[frakcjaKey];

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
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_przycisk').setLabel('Nazwa na przycisku (np. SAPD)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_discord').setLabel('Link Discord').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('add_podanie').setLabel('Link do podania').setStyle(TextInputStyle.Short).setRequired(true))
                );

                return await interaction.showModal(modal);
            }

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

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_edit_')) {
                    const key = interaction.customId.replace('modal_edit_', '');
                    if (CONFIG.frakcje[key]) {
                        CONFIG.frakcje[key].discord = interaction.fields.getTextInputValue('edit_discord');
                        CONFIG.frakcje[key].podanie = interaction.fields.getTextInputValue('edit_podanie');
                        await saveConfigToDb(CONFIG);
                        await updateAllPanels(client);
                    }
                    return interaction.reply({ content: '✅ Zaktualizowano linki i odświeżono aktywne panele w bazie danych!', ephemeral: true });
                }

                if (interaction.customId === 'modal_add_faction') {
                    const skrot = interaction.fields.getTextInputValue('add_skrot').toLowerCase().trim();
                    const pelna = interaction.fields.getTextInputValue('add_pelna').trim();
                    const przycisk = interaction.fields.getTextInputValue('add_przycisk').trim();
                    const discord = interaction.fields.getTextInputValue('add_discord').trim();
                    const podanie = interaction.fields.getTextInputValue('add_podanie').trim();

                    CONFIG.frakcje[skrot] = {
                        skrot: skrot,
                        pelnaNazwa: pelna,
                        nazwaPrzycisku: przycisk,
                        tekstLinijka: pelna,
                        discord: discord,
                        podanie: podanie
                    };
                    await saveConfigToDb(CONFIG);
                    await updateAllPanels(client);

                    return interaction.reply({ content: `✅ Pomyślnie dodano frakcję **${przycisk}** do bazy i zaktualizowano panele!`, ephemeral: true });
                }

                if (interaction.customId === 'modal_remove_faction') {
                    const skrot = interaction.fields.getTextInputValue('remove_skrot').toLowerCase().trim();

                    if (CONFIG.frakcje[skrot]) {
                        delete CONFIG.frakcje[skrot];
                        await saveConfigToDb(CONFIG);
                        await updateAllPanels(client);

                        return interaction.reply({ content: `✅ Pomyślnie usunięto frakcję o skrócie **${skrot}** z bazy i zaktualizowano panele!`, ephemeral: true });
                    } else {
                        return interaction.reply({ content: `❌ Nie znaleziono frakcji o takim skrócie!`, ephemeral: true });
                    }
                }
            }
        });
    }
};

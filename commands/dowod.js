const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const { getDb } = require('../utils/database');

const LOG_CHANNEL_ID = '1558460592648618155';
const DOWODY_CHANNEL_ID = '1558466596295417996';
const ADMIN_ROLE_ID = '1558536347042713661';

const localWnioskiCache = new Map();

// Automatyczne czyszczenie cache starszego niż 1 godzina[cite: 3]
setInterval(() => {
    const godzinaTemu = Date.now() - 60 * 60 * 1000;
    for (const [key, val] of localWnioskiCache.entries()) {
        if (new Date(val.createdAt).getTime() < godzinaTemu) {
            localWnioskiCache.delete(key);
        }
    }
}, 60 * 60 * 1000);

function hasAdminPermission(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(ADMIN_ROLE_ID);
}

async function sendLog(client, content) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) await channel.send({ content });
    } catch (error) {
        console.error('Błąd logowania:', error);
    }
}

async function sendDm(client, userId, content) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
            await user.send({ content }).catch(err => {
                console.error(`Nie udało się wysłać DM do użytkownika ${userId}:`, err.message);
            });
        }
    } catch (error) {
        console.error('Błąd pobierania użytkownika do DM:', error);
    }
}

async function checkRobloxAccount(nickRoblox) {
    try {
        const response = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(nickRoblox)}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.data || data.data.length === 0) return null;
        
        const exactMatch = data.data.find(u => u.name.toLowerCase() === nickRoblox.toLowerCase());
        if (!exactMatch) return null;

        return {
            id: exactMatch.id,
            name: exactMatch.name,
            profileUrl: `https://www.roblox.com/users/${exactMatch.id}/profile`
        };
    } catch (error) {
        console.error('Błąd sprawdzania konta Roblox:', error);
        return null;
    }
}

function parseImieNazwisko(pelneImie) {
    if (!pelneImie) return { imie: 'Brak', nazwisko: 'Brak' };
    const czesci = pelneImie.trim().split(/\s+/);
    return {
        imie: czesci[0] || 'Brak',
        nazwisko: czesci[1] || 'Brak'
    };
}

function parsePlec(text) {
    if (!text) return "Nieznana";
    const rawValue = text.trim().toUpperCase();
    if (rawValue.startsWith('K')) return 'Kobieta';
    if (rawValue.startsWith('M')) return 'Mężczyzna';
    if (rawValue.includes('KOBIETA')) return 'Kobieta';
    if (rawValue.includes('MĘŻCZYZNA') || rawValue.includes('MEZCZYZNA')) return 'Mężczyzna';
    return text.trim();
}

function formatDate(date) {
    if (!date) return "Brak";
    return new Date(date).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' });
}

function getCleanRobloxName(d) {
    if (d.rawRobloxName) return d.rawRobloxName;
    if (d.nickRoblox) {
        if (d.nickRoblox.startsWith('[')) {
            const match = d.nickRoblox.match(/\[(.*?)\]\((.*?)\)/);
            if (match) return match[1];
        }
        return d.nickRoblox;
    }
    return 'Brak';
}

function getRobloxUrl(d) {
    if (d.nickRobloxUrl) return d.nickRobloxUrl;
    if (d.nickRoblox && d.nickRoblox.startsWith('[')) {
        const match = d.nickRoblox.match(/\[(.*?)\]\((.*?)\)/);
        if (match) return match[2];
    }
    return 'Brak';
}

function buildDowodDescription(d) {
    const rawName = getCleanRobloxName(d);
    const url = getRobloxUrl(d);
    const robloxLinkFormatted = url && url !== 'Brak' ? `[Profil Roblox](${url})` : 'Brak';
    const plecFull = parsePlec(d.plec);

    return `# 🪪 Dowód tożsamości - <@${d.userId}>\n` +
           `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${d.imieNazwisko}\n` +
           `<:arrow:1543977081233342494> **Data urodzenia:** ${d.dataUrodzenia}\n` +
           `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${d.miejsceUrodzenia}\n` +
           `<:arrow:1543977081233342494> **Płeć:** ${plecFull}\n` +
           `<:arrow:1543977081233342494> **Nick Roblox:** ${rawName}\n` +
           `<:arrow:1543977081233342494> **Link Roblox:** ${robloxLinkFormatted}\n` +
           `<:arrow:1543977081233342494> **Nick Discord:** ${d.nickDiscord || 'Nieznany'}`;
}

function generateListaEmbed(dowody, page, totalPages) {
    const itemsPerPage = 5;
    const start = page * itemsPerPage;
    const pageItems = dowody.slice(start, start + itemsPerPage);

    const embed = new EmbedBuilder()
        .setTitle(`🪪 Lista Bazy Dowodów (${dowody.length})`)
        .setColor(0x2b2d31)
        .setFooter({ text: `Strona ${page + 1} z ${totalPages || 1}` });

    let desc = '';
    pageItems.forEach((d, idx) => {
        const rawName = getCleanRobloxName(d);
        const url = getRobloxUrl(d);
        const robloxLinkFormatted = url && url !== 'Brak' ? `[Profil Roblox](${url})` : 'Brak';
        const plecFull = parsePlec(d.plec);

        desc += `### ${start + idx + 1}. ${d.imieNazwisko}\n` +
                `<:arrow:1543977081233342494> **Właściciel:** <@${d.userId}> (\`${d.userId}\`)\n` +
                `<:arrow:1543977081233342494> **Data urodzenia:** ${d.dataUrodzenia}\n` +
                `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${d.miejsceUrodzenia}\n` +
                `<:arrow:1543977081233342494> **Płeć:** ${plecFull}\n` +
                `<:arrow:1543977081233342494> **Nick Roblox:** ${rawName}\n` +
                `<:arrow:1543977081233342494> **Link Roblox:** ${robloxLinkFormatted}\n` +
                `<:arrow:1543977081233342494> **Nick Discord:** ${d.nickDiscord || 'Nieznany'}\n\n`;
    });

    embed.setDescription(desc || 'Brak dowodów w bazie.');
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dowod')
        .setDescription('Zaawansowany system dowodów tożsamości.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Wysyła publiczny panel zarządzania dowodem dla użytkowników.'))
        .addSubcommand(sub =>
            sub.setName('admin-panel')
                .setDescription('Wysyła publiczny panel administracyjny do zarządzania dowodami.'))
        .addSubcommand(sub =>
            sub.setName('lista')
                .setDescription('Wyświetla pełną listę wszystkich utworzonych dowodów tożsamości.')),

    async execute(interaction) {
        try {
            if (!hasAdminPermission(interaction.member)) {
                return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Ta komenda jest dostępna tylko dla administratorów.', ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'panel') {
                const embed = new EmbedBuilder()
                    .setTitle('🪪 Centrum Dowodów Tożsamości')
                    .setDescription('Wybierz odpowiednią opcję poniżej, aby zarządzać swoim dowodem tożsamości.')
                    .setColor(0x2b2d31);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('dowod_stworz').setLabel('Złóż wniosek').setStyle(ButtonStyle.Primary).setEmoji('🪪'),
                    new ButtonBuilder().setCustomId('dowod_zobacz').setLabel('Zobacz dowód').setStyle(ButtonStyle.Secondary).setEmoji('🔍'),
                    new ButtonBuilder().setCustomId('dowod_edytuj_start').setLabel('Edytuj dowód').setStyle(ButtonStyle.Success).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('dowod_usun_start').setLabel('Usuń dowód').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.reply({ embeds: [embed], components: [row] });

            } else if (subcommand === 'admin-panel') {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Panel Administracyjny Dowodów')
                    .setDescription('Użyj poniższych przycisków, aby zarządzać bazą dowodów graczy.')
                    .setColor(0x2b2d31);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('admin_dowod_szukaj').setLabel('Znajdź dowód').setStyle(ButtonStyle.Primary).setEmoji('🔎'),
                    new ButtonBuilder().setCustomId('admin_dowod_lista_0').setLabel('Lista dowodów').setStyle(ButtonStyle.Secondary).setEmoji('📋')
                );

                await interaction.reply({ embeds: [embed], components: [row] });

            } else if (subcommand === 'lista') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const dowody = await db.collection('dowody').find({}).toArray();
                if (!dowody || dowody.length === 0) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> W bazie danych nie ma jeszcze żadnych dowodów.' });
                }

                const totalPages = Math.ceil(dowody.length / 5);
                const currentPage = 0;

                const embed = generateListaEmbed(dowody, currentPage, totalPages);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lista_prev_${currentPage}`).setLabel('Poprzednia').setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(true),
                    new ButtonBuilder().setCustomId(`lista_next_${currentPage}`).setLabel('Następna').setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(totalPages <= 1)
                );

                await interaction.editReply({ embeds: [embed], components: [row] });
            }
        } catch (error) {
            console.error('Błąd w /dowod:', error);
            const errPayload = { content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(errPayload);
            else await interaction.reply(errPayload);
        }
    },

    async handleButton(interaction) {
        try {
            const customId = interaction.customId;

            if (customId.startsWith('lista_prev_') || customId.startsWith('lista_next_')) {
                await interaction.deferUpdate();
                const db = getDb();
                if (!db) return;

                const dowody = await db.collection('dowody').find({}).toArray();
                const totalPages = Math.ceil(dowody.length / 5);

                const isNext = customId.startsWith('lista_next_');
                const oldPage = parseInt(customId.split('_')[2]);
                let newPage = isNext ? oldPage + 1 : oldPage - 1;

                if (newPage < 0) newPage = 0;
                if (newPage >= totalPages) newPage = totalPages - 1;

                const embed = generateListaEmbed(dowody, newPage, totalPages);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lista_prev_${newPage}`).setLabel('Poprzednia').setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(newPage === 0),
                    new ButtonBuilder().setCustomId(`lista_next_${newPage}`).setLabel('Następna').setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(newPage >= totalPages - 1)
                );

                await interaction.editReply({ embeds: [embed], components: [row] });
                return true;
            }

            if (customId === 'dowod_stworz') {
                const db = getDb();
                if (db) {
                    const existing = await db.collection('dowody').findOne({ userId: interaction.user.id });
                    if (existing) {
                        return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Masz już zatwierdzony dowód tożsamości!', ephemeral: true });
                    }
                    const pending = await db.collection('wnioski_dowody').findOne({ 'dane.userId': interaction.user.id, 'dane.type': { $exists: false } });
                    if (pending) {
                        return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Masz już oczekujący wniosek o dowód! Poczekaj na jego rozpatrzenie.', ephemeral: true });
                    }
                }

                const modal = new ModalBuilder().setCustomId('modal_dowod_skladanie').setTitle('Wniosek o Dowód Tożsamości');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_imie').setLabel('Imię i Nazwisko (np. Jan Kowalski)').setPlaceholder('Wpisz dokładnie jedno imię i jedno nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_data').setLabel('Data urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_miejsce').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            if (customId === 'dowod_zobacz') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const dowod = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!dowod) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie posiadasz zatwierdzonego dowodu.' });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(buildDowodDescription(dowod));

                await interaction.editReply({ embeds: [embed] });
                return true;
            }

            if (customId === 'dowod_edytuj_start') {
                const db = getDb();
                if (!db) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.', ephemeral: true });

                const dowod = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!dowod) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie posiadasz dowodu do edycji.', ephemeral: true });
                }

                const pendingEdit = await db.collection('wnioski_dowody').findOne({ 'dane.userId': interaction.user.id, 'dane.type': 'edycja' });
                if (pendingEdit) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Masz już oczekującą prośbę o edycję! Poczekaj na jej rozpatrzenie.', ephemeral: true });
                }

                const cleanRobloxName = getCleanRobloxName(dowod);
                const modal = new ModalBuilder().setCustomId('modal_dowod_edycja').setTitle('Prośba o Edycję Dowodu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_imie').setLabel('Imię i Nazwisko').setValue(dowod.imieNazwisko).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_data').setLabel('Data urodzenia').setValue(dowod.dataUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_miejsce').setLabel('Miejsce urodzenia').setValue(dowod.miejsceUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_plec').setLabel('Płeć (M / K)').setValue(dowod.plec.startsWith('M') ? 'M' : 'K').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_roblox').setLabel('Nick Roblox').setValue(cleanRobloxName).setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            if (customId === 'dowod_usun_start') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const dowod = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!dowod) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie posiadasz dowodu do usunięcia.' });
                }

                const pendingUsun = await db.collection('wnioski_dowody').findOne({ 'dane.userId': interaction.user.id, 'dane.type': 'usun' });
                if (pendingUsun) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Masz już oczekującą prośbę o usunięcie! Poczekaj na jej rozpatrzenie.' });
                }

                const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono kanału logów.' });

                const uniqueId = `${interaction.user.id}_${Date.now()}`;
                const payload = {
                    type: 'usun',
                    userId: interaction.user.id,
                    createdAt: new Date(),
                    stareDane: dowod
                };
                await db.collection('wnioski_dowody').insertOne({ messageId: uniqueId, dane: payload });

                const embed = new EmbedBuilder()
                    .setColor(0xed4245)
                    .setDescription(buildDowodDescription(dowod));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_usun_${interaction.user.id}_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_usun_${interaction.user.id}_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                const sentMsg = await channel.send({ embeds: [embed], components: [row] });
                payload.messageId = sentMsg.id;
                await db.collection('wnioski_dowody').updateOne({ messageId: uniqueId }, { $set: { messageId: sentMsg.id } }, { upsert: true });

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_usun_${interaction.user.id}_${sentMsg.id}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_usun_${interaction.user.id}_${sentMsg.id}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );
                await sentMsg.edit({ components: [updatedRow] });

                await sendDm(interaction.client, interaction.user.id, '# <a:checkmark:1543969158646206475> Prośba wysłana\n<:arrow:1543977081233342494> Twoja prośba o usunięcie dowodu została przekazana do administracji.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wysłano prośbę o usunięcie dowodu do administracji.' });
                return true;
            }

            if (customId === 'admin_dowod_szukaj') {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                const modal = new ModalBuilder().setCustomId('modal_admin_szukaj').setTitle('Znajdź Dowód Użytkownika');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('szukaj_fraza').setLabel('ID, Imię i Nazwisko lub Roblox').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            if (customId.startsWith('admin_dowod_lista_')) {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }

                const page = parseInt(customId.replace('admin_dowod_lista_', '')) || 0;
                const itemsPerPage = 25;

                const db = getDb();
                if (!db) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.', ephemeral: true });

                const dowody = await db.collection('dowody').find({}).toArray();
                if (!dowody || dowody.length === 0) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak dowodów w bazie danych.', ephemeral: true });
                }

                const totalPages = Math.ceil(dowody.length / itemsPerPage);
                const currentPage = Math.min(page, totalPages - 1);
                const start = currentPage * itemsPerPage;
                const pageItems = dowody.slice(start, start + itemsPerPage);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_admin_dowod')
                    .setPlaceholder(`Lista dowodów — strona ${currentPage + 1} z ${totalPages}`);

                pageItems.forEach(d => {
                    const rawName = getCleanRobloxName(d);
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${d.imieNazwisko}`.slice(0, 100))
                            .setDescription(`Roblox: ${rawName} | ID: ${d.userId}`.slice(0, 100))
                            .setValue(d.userId)
                    );
                });

                const navButtons = [];
                if (currentPage > 0) {
                    navButtons.push(
                        new ButtonBuilder()
                            .setCustomId(`admin_dowod_lista_${currentPage - 1}`)
                            .setLabel('◀️ Poprzednia')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                if (currentPage < totalPages - 1) {
                    navButtons.push(
                        new ButtonBuilder()
                            .setCustomId(`admin_dowod_lista_${currentPage + 1}`)
                            .setLabel('Następna ▶️')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                const components = [new ActionRowBuilder().addComponents(selectMenu)];
                if (navButtons.length > 0) {
                    components.push(new ActionRowBuilder().addComponents(...navButtons));
                }

                const replyPayload = {
                    content: `# 📋 Lista dowodów (${dowody.length} łącznie) — strona ${currentPage + 1} z ${totalPages}\n<:arrow:1543977081233342494> Wybierz gracza z listy poniżej, aby wyświetlić i zarządzać jego dowodem.`,
                    components,
                    ephemeral: true
                };

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(replyPayload);
                } else {
                    await interaction.reply(replyPayload);
                }
                return true;
            }

            const parts = customId.split('_');
            if (parts[0] !== 'dowod') return false;

            const actionType = parts[1]; 
            const subAction = parts[2]; 
            const targetUserId = parts[3]; 
            const messageId = parts.slice(4).join('_');

            if (actionType === 'odrzuc') {
                const modal = new ModalBuilder()
                    .setCustomId(`modal_odrzuc_powod_${subAction}_${targetUserId}_${interaction.message.id}`)
                    .setTitle('Powód odrzucenia wniosku');

                const powodInput = new TextInputBuilder()
                    .setCustomId('odrzuc_powod')
                    .setLabel('Podaj powód odrzucenia')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Np. Niepoprawna data urodzenia, brak zgody...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(powodInput));
                await interaction.showModal(modal);
                return true;
            }

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const db = getDb();
            let wniosek = localWnioskiCache.get(messageId);
            if (!wniosek && db) {
                const found = await db.collection('wnioski_dowody').findOne({ messageId });
                if (found) wniosek = found.dane;
            }

            if (actionType === 'akceptuj') {
                if (subAction === 'stworz') {
                    const imieNazwisko = wniosek ? wniosek.imieNazwisko : "Nieznane";
                    const dataUrodzenia = wniosek ? wniosek.dataUrodzenia : "Brak";
                    const miejsceUrodzenia = wniosek ? wniosek.miejsceUrodzenia : "Brak";
                    const plec = wniosek ? parsePlec(wniosek.plec) : "Nieznana";
                    const rawRobloxName = wniosek ? wniosek.rawRobloxName : "Brak";
                    const nickRobloxUrl = wniosek ? wniosek.nickRobloxUrl : "Brak";
                    const nickDiscord = wniosek ? wniosek.nickDiscord : "Nieznany";
                    const createdAt = wniosek ? wniosek.createdAt : new Date();

                    const sprawdzenieImienia = parseImieNazwisko(imieNazwisko);
                    if (sprawdzenieImienia.imie === 'Brak' || sprawdzenieImienia.nazwisko === 'Brak') {
                        return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wniosek posiada niepoprawny format imienia i nazwiska (wymagane jedno imię i jedno nazwisko).' });
                    }

                    const dowodObj = { userId: targetUserId, imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, rawRobloxName, nickRobloxUrl, nickDiscord, approvedAt: new Date() };

                    if (db) {
                        await db.collection('dowody').updateOne({ userId: targetUserId }, { $set: dowodObj }, { upsert: true });
                        await db.collection('wnioski_dowody').deleteOne({ messageId });
                    }

                    const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                    let sentDowodMsgId = null;
                    if (channelDowody) {
                        const embedDowod = new EmbedBuilder()
                            .setColor(0x2b2d31)
                            .setDescription(buildDowodDescription(dowodObj));

                        const sentDMsg = await channelDowody.send({ 
                            content: `<@${targetUserId}>`, 
                            embeds: [embedDowod]
                        });
                        sentDowodMsgId = sentDMsg.id;

                        if (db) await db.collection('dowody').updateOne({ userId: targetUserId }, { $set: { messageId: sentDowodMsgId } });
                    }

                    if (interaction.message.embeds.length > 0) {
                        const origEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor(0x57f287)
                            .setTitle('🪪 Wniosek o Dowód - ZAAKCEPTOWANY')
                            .addFields(
                                { name: 'Data prośby', value: formatDate(createdAt), inline: true },
                                { name: 'Data zaakceptowania', value: formatDate(new Date()), inline: true },
                                { name: 'Zaakceptował', value: interaction.user.tag, inline: true }
                            );
                        await interaction.message.edit({ embeds: [origEmbed], components: [] }).catch(() => {});
                    }

                    await sendDm(interaction.client, targetUserId, '# <a:checkmark:1543969158646206475> Wniosek zaakceptowany\n<:arrow:1543977081233342494> Twój wniosek o dowód tożsamości został zatwierdzony przez administrację!');
                    await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie zaakceptowano wniosek o dowód.' });

                } else if (subAction === 'usun') {
                    const stareDane = wniosek ? wniosek.stareDane : null;
                    const createdAt = wniosek ? wniosek.createdAt : new Date();

                    if (db) {
                        await db.collection('dowody').deleteOne({ userId: targetUserId });
                        await db.collection('wnioski_dowody').deleteOne({ messageId });
                    }

                    if (stareDane && stareDane.messageId) {
                        const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                        if (channelDowody) {
                            const msg = await channelDowody.messages.fetch(stareDane.messageId).catch(() => null);
                            if (msg) await msg.delete().catch(() => {});
                        }
                    }

                    if (interaction.message.embeds.length > 0) {
                        const origEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor(0xed4245)
                            .setTitle('🗑️ Prośba o Usunięcie - ZAAKCEPTOWANA')
                            .addFields(
                                { name: 'Data prośby', value: formatDate(createdAt), inline: true },
                                { name: 'Data zaakceptowania', value: formatDate(new Date()), inline: true },
                                { name: 'Zaakceptował', value: interaction.user.tag, inline: true }
                            );
                        await interaction.message.edit({ embeds: [origEmbed], components: [] }).catch(() => {});
                    }

                    await sendDm(interaction.client, targetUserId, '# <a:checkmark:1543969158646206475> Usunięcie dowodu\n<:arrow:1543977081233342494> Twoja prośba o usunięcie dowodu została zatwierdzona.');
                    await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Zatwierdzono usunięcie dowodu.' });

                } else if (subAction === 'edycja') {
                    if (!wniosek) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono danych.' });
                    const { createdAt, stareDane, noweDane } = wniosek;

                    const updateObj = { 
                        imieNazwisko: noweDane.imieNazwisko, 
                        dataUrodzenia: noweDane.dataUrodzenia, 
                        miejsceUrodzenia: noweDane.miejsceUrodzenia, 
                        plec: parsePlec(noweDane.plec), 
                        rawRobloxName: noweDane.rawRobloxName,
                        nickRobloxUrl: noweDane.nickRobloxUrl,
                        updatedAt: new Date() 
                    };

                    if (db) {
                        await db.collection('dowody').updateOne({ userId: targetUserId }, { $set: updateObj });
                        await db.collection('wnioski_dowody').deleteOne({ messageId });
                    }

                    const fullUpdatedDowod = { userId: targetUserId, ...updateObj, nickDiscord: stareDane.nickDiscord };

                    if (stareDane && stareDane.messageId) {
                        const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                        if (channelDowody) {
                            const msg = await channelDowody.messages.fetch(stareDane.messageId).catch(() => null);
                            if (msg) {
                                const newEmbed = new EmbedBuilder()
                                    .setColor(0x2b2d31)
                                    .setDescription(buildDowodDescription(fullUpdatedDowod))
                                    .setFooter({ text: `Dane dowodu zostały edytowane (${formatDate(new Date())})` });
                                await msg.edit({ content: `<@${targetUserId}>`, embeds: [newEmbed] }).catch(() => {});
                            }
                        }
                    }

                    const oldEmbed = new EmbedBuilder()
                        .setColor(0x000000)
                        .setDescription(buildDowodDescription(stareDane))
                        .setFooter({ text: 'Dowód przed edycją' });

                    const newEmbedLog = new EmbedBuilder()
                        .setColor(0x57f287)
                        .setDescription(buildDowodDescription(fullUpdatedDowod))
                        .addFields(
                            { name: 'Data prośby', value: formatDate(createdAt), inline: true },
                            { name: 'Data zaakceptowania', value: formatDate(new Date()), inline: true },
                            { name: 'Zaakceptował', value: interaction.user.tag, inline: true }
                        );

                    await interaction.message.edit({ embeds: [oldEmbed, newEmbedLog], components: [] }).catch(() => {});
                    await sendDm(interaction.client, targetUserId, '# <a:checkmark:1543969158646206475> Edycja zatwierdzona\n<:arrow:1543977081233342494> Twoja prośba o edycję danych dowodu została zaakceptowana.');
                    await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Zatwierdzono edycję dowodu.' });
                }
            }

            return true;
        } catch (error) {
            console.error('Błąd button handler:', error);
            try {
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd.' });
                else await interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd.', ephemeral: true });
            } catch {}
            return true;
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_admin_dowod') {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const targetUserId = interaction.values[0];
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.' });

                const wynik = await db.collection('dowody').findOne({ userId: targetUserId });
                if (!wynik) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono wybranego dowodu.' });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(buildDowodDescription(wynik));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`admin_zrob_edycja_${wynik.userId}`).setLabel('Edytuj jako Admin').setStyle(ButtonStyle.Success).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId(`admin_zrob_usun_${wynik.userId}`).setLabel('Usuń jako Admin').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });
                return;
            }

            if (!interaction.isModalSubmit()) return;

            if (interaction.customId.startsWith('modal_odrzuc_powod_')) {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const parts = interaction.customId.split('_');
                const targetUserId = parts[4];
                const logMessageId = parts.slice(5).join('_');

                const powod = interaction.fields.getTextInputValue('odrzuc_powod').trim();
                const db = getDb();
                
                if (db) await db.collection('wnioski_dowody').deleteOne({ messageId: logMessageId });

                const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (channel) {
                    const msg = await channel.messages.fetch(logMessageId).catch(() => null);
                    if (msg && msg.embeds.length > 0) {
                        const origEmbed = EmbedBuilder.from(msg.embeds[0])
                            .setColor(0xed4245)
                            .setTitle('❌ Wniosek / Prośba - ODRZUCONY')
                            .addFields(
                                { name: 'Odrzucił', value: interaction.user.tag, inline: true },
                                { name: 'Powód odrzucenia', value: powod, inline: false }
                            );
                        await msg.edit({ embeds: [origEmbed], components: [] }).catch(() => {});
                    }
                }

                if (targetUserId) {
                    await sendDm(interaction.client, targetUserId, '# <a:redtick:1543991522192527450> Wniosek odrzucony\n<:arrow:1543977081233342494> Twój wniosek/prośba o dowód został odrzucony przez administrację.\n<:arrow:1543977081233342494> **Powód:** ' + powod);
                }

                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie odrzucono wniosek i wysłano powód na PV.' });
                return;
            }

            if (interaction.customId === 'modal_dowod_skladanie') {
                await interaction.deferReply({ ephemeral: true });
                const imieNazwisko = interaction.fields.getTextInputValue('dowod_imie').trim();
                
                const sprawdzenie = parseImieNazwisko(imieNazwisko);
                if (sprawdzenie.imie === 'Brak' || sprawdzenie.nazwisko === 'Brak') {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wpisz dokładnie **jedno imię i jedno nazwisko** oddzielone spacją (np. *Jan Kowalski*).' });
                }

                const dataUrodzenia = interaction.fields.getTextInputValue('dowod_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('dowod_miejsce').trim();
                const rawPlec = interaction.fields.getTextInputValue('dowod_plec').trim();
                const plec = parsePlec(rawPlec);
                const rawNickRoblox = interaction.fields.getTextInputValue('dowod_roblox').trim();
                const nickDiscord = interaction.user.tag;

                const robloxCheck = await checkRobloxAccount(rawNickRoblox);
                if (!robloxCheck) {
                    await sendDm(client, interaction.user.id, '# <a:redtick:1543991522192527450> Wniosek odrzucony automatycznie\n<:arrow:1543977081233342494> Podane konto Roblox (**' + rawNickRoblox + '**) nie istnieje w bazie Roblox. Wniosek został odrzucony.');
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd weryfikacji Roblox\n<:arrow:1543977081233342494> Konto Roblox o nazwie **' + rawNickRoblox + '** nie istnieje. Wniosek został automatycznie odrzucony.' });
                }

                const rawRobloxName = robloxCheck.name;
                const nickRobloxUrl = robloxCheck.profileUrl;

                const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak kanału logów.' });

                const uniqueId = `${interaction.user.id}_${Date.now()}`;
                const payload = {
                    messageId: uniqueId,
                    userId: interaction.user.id,
                    imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, rawRobloxName, nickRobloxUrl, nickDiscord,
                    createdAt: new Date()
                };

                const db = getDb();
                if (db) await db.collection('wnioski_dowody').insertOne({ messageId: uniqueId, dane: payload });
                localWnioskiCache.set(uniqueId, payload);

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setDescription(buildDowodDescription(payload));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_stworz_${interaction.user.id}_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_stworz_${interaction.user.id}_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                const sentMsg = await channel.send({ embeds: [embed], components: [row] });
                if (db) {
                    await db.collection('wnioski_dowody').deleteOne({ messageId: uniqueId });
                    payload.messageId = sentMsg.id;
                    await db.collection('wnioski_dowody').insertOne({ messageId: sentMsg.id, dane: payload });
                }

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_stworz_${interaction.user.id}_${sentMsg.id}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_stworz_${interaction.user.id}_${sentMsg.id}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );
                await sentMsg.edit({ components: [updatedRow] });

                await sendDm(client, interaction.user.id, '# <a:checkmark:1543969158646206475> Wniosek wysłany\n<:arrow:1543977081233342494> Twój wniosek o dowód tożsamości został wysłany do weryfikacji!');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wniosek został wysłany do weryfikacji!' });
            }

            if (interaction.customId === 'modal_dowod_edycja') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const stareDane = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!stareDane) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.' });

                const imieNazwisko = interaction.fields.getTextInputValue('dowod_imie').trim();
                const sprawdzenie = parseImieNazwisko(imieNazwisko);
                if (sprawdzenie.imie === 'Brak' || sprawdzenie.nazwisko === 'Brak') {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wpisz dokładnie **jedno imię i jedno nazwisko** oddzielone spacją.' });
                }

                const rawNickRoblox = interaction.fields.getTextInputValue('dowod_roblox').trim();
                const robloxCheck = await checkRobloxAccount(rawNickRoblox);
                if (!robloxCheck) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd weryfikacji Roblox\n<:arrow:1543977081233342494> Konto Roblox o nazwie **' + rawNickRoblox + '** nie istnieje. Edycja odrzucona.' });
                }

                const noweDane = {
                    imieNazwisko,
                    dataUrodzenia: interaction.fields.getTextInputValue('dowod_data').trim(),
                    miejsceUrodzenia: interaction.fields.getTextInputValue('dowod_miejsce').trim(),
                    plec: parsePlec(interaction.fields.getTextInputValue('dowod_plec').trim()),
                    rawRobloxName: robloxCheck.name,
                    nickRobloxUrl: robloxCheck.profileUrl,
                    nickDiscord: interaction.user.tag
                };

                const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak kanału logów.' });

                const uniqueId = `${interaction.user.id}_${Date.now()}`;
                const payload = {
                    type: 'edycja',
                    userId: interaction.user.id,
                    createdAt: new Date(),
                    stareDane,
                    noweDane
                };
                await db.collection('wnioski_dowody').insertOne({ messageId: uniqueId, dane: payload });

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setDescription(buildDowodDescription({ userId: interaction.user.id, ...noweDane }));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_edycja_${interaction.user.id}_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_edycja_${interaction.user.id}_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                const sentMsg = await channel.send({ embeds: [embed], components: [row] });
                payload.messageId = sentMsg.id;
                await db.collection('wnioski_dowody').updateOne({ messageId: uniqueId }, { $set: { messageId: sentMsg.id } }, { upsert: true });

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_edycja_${interaction.user.id}_${sentMsg.id}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_edycja_${interaction.user.id}_${sentMsg.id}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );
                await sentMsg.edit({ components: [updatedRow] });

                await sendDm(client, interaction.user.id, '# <a:checkmark:1543969158646206475> Prośba o edycję\n<:arrow:1543977081233342494> Twoja prośba o edycję danych została wysłana do administracji.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wysłano prośbę o edycję do administracji.' });
            }

            if (interaction.customId === 'modal_admin_szukaj') {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const fraza = interaction.fields.getTextInputValue('szukaj_fraza').trim().toLowerCase();
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.' });

                const dowody = await db.collection('dowody').find({}).toArray();
                const wyniki = dowody.filter(d => {
                    const rawNick = getCleanRobloxName(d).toLowerCase();
                    return d.userId === fraza || 
                        (d.imieNazwisko || '').toLowerCase().includes(fraza) || 
                        rawNick.includes(fraza);
                });

                if (wyniki.length === 0) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu o podanych kryteriach.' });
                }

                if (wyniki.length === 1) {
                    const wynik = wyniki[0];
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                        .setDescription(buildDowodDescription(wynik));

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`admin_zrob_edycja_${wynik.userId}`).setLabel('Edytuj jako Admin').setStyle(ButtonStyle.Success).setEmoji('✏️'),
                        new ButtonBuilder().setCustomId(`admin_zrob_usun_${wynik.userId}`).setLabel('Usuń jako Admin').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    );

                    await interaction.editReply({ embeds: [embed], components: [row] });
                    return;
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_admin_dowod')
                    .setPlaceholder('Wybierz dowód z listy...');

                wyniki.slice(0, 25).forEach(d => {
                    const rawName = getCleanRobloxName(d);
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${d.imieNazwisko}`.slice(0, 100))
                            .setDescription(`Roblox: ${rawName} | ID: ${d.userId}`.slice(0, 100))
                            .setValue(d.userId)
                    );
                });

                const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({
                    content: `# 🔍 Znaleziono **${wyniki.length}** dowody/dowodów\n<:arrow:1543977081233342494> Wybierz osobę z poniższej listy, aby wyświetlić i edytować jej dowód:`,
                    components: [rowSelect]
                });
            }

            if (interaction.customId.startsWith('modal_admin_edytuj_zapisz_')) {
                if (!hasAdminPermission(interaction.member)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.replace('modal_admin_edytuj_zapisz_', '');
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const imieNazwisko = interaction.fields.getTextInputValue('admin_ed_imie').trim();
                const sprawdzenie = parseImieNazwisko(imieNazwisko);
                if (sprawdzenie.imie === 'Brak' || sprawdzenie.nazwisko === 'Brak') {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wpisz dokładnie **jedno imię i jedno nazwisko** oddzielone spacją.' });
                }

                const dataUrodzenia = interaction.fields.getTextInputValue('admin_ed_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('admin_ed_miejsce').trim();
                const plec = parsePlec(interaction.fields.getTextInputValue('admin_ed_plec').trim());
                const rawRoblox = interaction.fields.getTextInputValue('admin_ed_roblox').trim();

                const robloxCheck = await checkRobloxAccount(rawRoblox);
                if (!robloxCheck) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd weryfikacji Roblox\n<:arrow:1543977081233342494> Konto Roblox o nazwie **' + rawRoblox + '** nie istnieje.' });
                }
                const rawRobloxName = robloxCheck.name;
                const nickRobloxUrl = robloxCheck.profileUrl;

                const dowod = await db.collection('dowody').findOne({ userId });
                if (!dowod) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.' });

                const updatedFields = { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, rawRobloxName, nickRobloxUrl, updatedAt: new Date() };
                await db.collection('dowody').updateOne({ userId }, { $set: updatedFields });

                const fullUpdatedDowod = { ...dowod, ...updatedFields };

                if (dowod.messageId) {
                    const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                    if (channelDowody) {
                        const msg = await channelDowody.messages.fetch(dowod.messageId).catch(() => null);
                        if (msg) {
                            const newEmbed = new EmbedBuilder()
                                .setColor(0x2b2d31)
                                .setDescription(buildDowodDescription(fullUpdatedDowod))
                                .setFooter({ text: `Dane dowodu zostały edytowane przez administratora (${formatDate(new Date())})` });
                            await msg.edit({ content: `<@${userId}>`, embeds: [newEmbed] }).catch(() => {});
                        }
                    }
                }

                await sendDm(client, userId, '# <a:checkmark:1543969158646206475> Dowód edytowany\n<:arrow:1543977081233342494> Twój dowód został zaktualizowany przez administratora.');
                await sendLog(client, `# <a:dot:1543969325155745812> **Admin edytował dowód**\n<:arrow:1543977081233342494> **Właściciel:** <@${userId}> | **Admin:** ${interaction.user.tag}`);
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie zaktualizowano dowód użytkownika.' });
            }
        });

        client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;

            if (interaction.customId.startsWith('admin_zrob_usun_')) {
                if (!hasAdminPermission(interaction.member)) return;
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.replace('admin_zrob_usun_', '');
                const db = getDb();

                if (db) {
                    const dowod = await db.collection('dowody').findOne({ userId });
                    if (dowod && dowod.messageId) {
                        const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                        if (channelDowody) {
                            const msg = await channelDowody.messages.fetch(dowod.messageId).catch(() => null);
                            if (msg) await msg.delete().catch(() => {});
                        }
                    }
                    await db.collection('dowody').deleteOne({ userId });
                }

                await sendDm(client, userId, '# <a:redtick:1543991522192527450> Dowód usunięty\n<:arrow:1543977081233342494> Twój dowód został usunięty przez administratora.');
                await sendLog(client, `# <a:dot:1543969325155745812> **Admin usunął dowód**\n<:arrow:1543977081233342494> **Właściciel:** <@${userId}> | **Admin:** ${interaction.user.tag}`);
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Usunięto dowód użytkownika.' });
            }

            if (interaction.customId.startsWith('admin_zrob_edycja_')) {
                if (!hasAdminPermission(interaction.member)) return;
                const userId = interaction.customId.replace('admin_zrob_edycja_', '');
                const db = getDb();
                if (!db) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.', ephemeral: true });

                const dowod = await db.collection('dowody').findOne({ userId });
                if (!dowod) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.', ephemeral: true });

                const cleanRobloxName = getCleanRobloxName(dowod);
                const modal = new ModalBuilder().setCustomId(`modal_admin_edytuj_zapisz_${userId}`).setTitle('Edycja Dowodu (Admin)');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_imie').setLabel('Imię i Nazwisko').setValue(dowod.imieNazwisko).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_data').setLabel('Data urodzenia').setValue(dowod.dataUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_miejsce').setLabel('Miejsce urodzenia').setValue(dowod.miejsceUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_plec').setLabel('Płeć (M / K)').setValue(dowod.plec.startsWith('M') ? 'M' : 'K').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_roblox').setLabel('Nick Roblox').setValue(cleanRobloxName).setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            }
        });
    },

    parsePlec,
    localWnioskiCache
};
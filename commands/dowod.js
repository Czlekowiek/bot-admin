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

const localWnioskiCache = new Map();

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
                console.error(`Nie udało się wysłać DM do użytkownika ${userId} (możliwe zablokowane PV):`, err.message);
            });
        }
    } catch (error) {
        console.error('Błąd pobierania użytkownika do DM:', error);
    }
}

function parsePlec(text) {
    if (!text) return "Nieznana";
    const rawValue = text.trim().toUpperCase();
    if (rawValue.startsWith('K')) return 'K';
    if (rawValue.startsWith('M')) return 'M';
    return "Nieznana";
}

function formatDate(date) {
    if (!date) return "Brak";
    return new Date(date).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' });
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
        desc += `### ${start + idx + 1}. ${d.imieNazwisko}\n` +
                `<:arrow:1543977081233342494> **Właściciel:** <@${d.userId}> (\`${d.userId}\`)\n` +
                `<:arrow:1543977081233342494> **Data urodzenia:** ${d.dataUrodzenia}\n` +
                `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${d.miejsceUrodzenia}\n` +
                `<:arrow:1543977081233342494> **Płeć:** ${d.plec}\n` +
                `<:arrow:1543977081233342494> **Nick Roblox:** ${d.nickRoblox || 'Brak'}\n\n`;
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
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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
                    new ButtonBuilder().setCustomId('admin_dowod_weryfikuj').setLabel('Ręczna weryfikacja').setStyle(ButtonStyle.Success).setEmoji('🛠️')
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
                }

                const modal = new ModalBuilder().setCustomId('modal_dowod_skladanie').setTitle('Wniosek o Dowód Tożsamości');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
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
                    .setTitle(`🪪 Dowód Tożsamości - ${dowod.imieNazwisko}`)
                    .setColor(0x2b2d31)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${dowod.imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Data urodzenia:** ${dowod.dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${dowod.miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Płeć:** ${dowod.plec}\n` +
                        `<:arrow:1543977081233342494> **Nick Roblox:** ${dowod.nickRoblox}\n` +
                        `<:arrow:1543977081233342494> **Nick Discord:** ${dowod.nickDiscord}`
                    );
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

                const modal = new ModalBuilder().setCustomId('modal_dowod_edycja').setTitle('Prośba o Edycję Dowodu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_imie').setLabel('Imię i Nazwisko').setValue(dowod.imieNazwisko).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_data').setLabel('Data urodzenia').setValue(dowod.dataUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_miejsce').setLabel('Miejsce urodzenia').setValue(dowod.miejsceUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_plec').setLabel('Płeć (M / K)').setValue(dowod.plec).setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_roblox').setLabel('Nick Roblox').setValue(dowod.nickRoblox).setStyle(TextInputStyle.Short).setRequired(true))
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
                    .setTitle('🗑️ Prośba o Usunięcie Dowodu')
                    .setColor(0xed4245)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Ping:** <@${interaction.user.id}>\n` +
                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${dowod.imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Data urodzenia:** ${dowod.dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${dowod.miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Płeć:** ${dowod.plec}\n` +
                        `<:arrow:1543977081233342494> **Nick Roblox:** ${dowod.nickRoblox}\n` +
                        `<:arrow:1543977081233342494> **Nick Discord:** ${dowod.nickDiscord}\n` +
                        `<:arrow:1543977081233342494> **Data prośby:** ${formatDate(new Date())}`
                    );

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
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                const modal = new ModalBuilder().setCustomId('modal_admin_szukaj').setTitle('Znajdź Dowód Użytkownika');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('szukaj_fraza').setLabel('ID, Imię i Nazwisko lub Roblox').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            if (customId === 'admin_dowod_weryfikuj') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak uprawnień.', ephemeral: true });
                }
                const modal = new ModalBuilder().setCustomId('modal_admin_weryfikuj').setTitle('Ręczne Utworzenie Dowodu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_id').setLabel('ID Użytkownika Discord').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_data').setLabel('Data urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_miejsce').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true))
                );
                await interaction.showModal(modal);
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
                    const plec = wniosek ? wniosek.plec : "Nieznana";
                    const nickRoblox = wniosek ? wniosek.nickRoblox : "Brak";
                    const nickDiscord = wniosek ? wniosek.nickDiscord : "Nieznany";
                    const createdAt = wniosek ? wniosek.createdAt : new Date();

                    if (db) {
                        await db.collection('dowody').updateOne({ userId: targetUserId }, { $set: { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord, approvedAt: new Date() } }, { upsert: true });
                        await db.collection('wnioski_dowody').deleteOne({ messageId });
                    }

                    const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                    let sentDowodMsgId = null;
                    if (channelDowody) {
                        const embedDowod = new EmbedBuilder()
                            .setTitle(`🪪 Dowód Tożsamości - ${imieNazwisko}`)
                            .setColor(0x2b2d31)
                            .setDescription(
                                `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                                `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                                `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                                `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                                `<:arrow:1543977081233342494> **Nick Roblox:** ${nickRoblox}\n` +
                                `<:arrow:1543977081233342494> **Nick Discord:** ${nickDiscord}`
                            );
                        const sentDMsg = await channelDowody.send({ content: `<@${targetUserId}>`, embeds: [embedDowod] });
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

                    if (db) {
                        await db.collection('dowody').updateOne({ userId: targetUserId }, { 
                            $set: { 
                                imieNazwisko: noweDane.imieNazwisko, 
                                dataUrodzenia: noweDane.dataUrodzenia, 
                                miejsceUrodzenia: noweDane.miejsceUrodzenia, 
                                plec: noweDane.plec, 
                                nickRoblox: noweDane.nickRoblox,
                                updatedAt: new Date() 
                            } 
                        });
                        await db.collection('wnioski_dowody').deleteOne({ messageId });
                    }

                    if (stareDane && stareDane.messageId) {
                        const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                        if (channelDowody) {
                            const msg = await channelDowody.messages.fetch(stareDane.messageId).catch(() => null);
                            if (msg) {
                                const newEmbed = new EmbedBuilder()
                                    .setTitle(`🪪 Dowód Tożsamości - ${noweDane.imieNazwisko}`)
                                    .setColor(0x2b2d31)
                                    .setDescription(
                                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${noweDane.imieNazwisko}\n` +
                                        `<:arrow:1543977081233342494> **Data urodzenia:** ${noweDane.dataUrodzenia}\n` +
                                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${noweDane.miejsceUrodzenia}\n` +
                                        `<:arrow:1543977081233342494> **Płeć:** ${noweDane.plec}\n` +
                                        `<:arrow:1543977081233342494> **Nick Roblox:** ${noweDane.nickRoblox}\n` +
                                        `<:arrow:1543977081233342494> **Nick Discord:** ${noweDane.nickDiscord}`
                                    )
                                    .setFooter({ text: `Dane dowodu zostały edytowane (${formatDate(new Date())})` });
                                await msg.edit({ embeds: [newEmbed] }).catch(() => {});
                            }
                        }
                    }

                    const oldEmbed = new EmbedBuilder()
                        .setTitle('🪪 Dowód przed edycją')
                        .setColor(0x000000)
                        .setDescription(
                            `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${stareDane.imieNazwisko}\n` +
                            `<:arrow:1543977081233342494> **Data urodzenia:** ${stareDane.dataUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${stareDane.miejsceUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Płeć:** ${stareDane.plec}\n` +
                            `<:arrow:1543977081233342494> **Nick Roblox:** ${stareDane.nickRoblox}`
                        );

                    const newEmbedLog = new EmbedBuilder()
                        .setTitle('🪪 Prośba o Edycję - ZAAKCEPTOWANA')
                        .setColor(0x57f287)
                        .setDescription(
                            `<:arrow:1543977081233342494> **Nowe Imię i Nazwisko:** ${noweDane.imieNazwisko}\n` +
                            `<:arrow:1543977081233342494> **Nowa data urodzenia:** ${noweDane.dataUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Nowe miejsce urodzenia:** ${noweDane.miejsceUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Nowa płeć:** ${noweDane.plec}\n` +
                            `<:arrow:1543977081233342494> **Nowy Roblox:** ${noweDane.nickRoblox}`
                        )
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
                await interaction.deferReply({ ephemeral: true });
                const targetUserId = interaction.values[0];
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.' });

                const wynik = await db.collection('dowody').findOne({ userId: targetUserId });
                if (!wynik) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono wybranego dowodu.' });

                const embed = new EmbedBuilder()
                    .setTitle(`🪪 Wybrany Dowód: ${wynik.imieNazwisko}`)
                    .setColor(0x2b2d31)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Ping właściciela:** <@${wynik.userId}>\n` +
                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${wynik.imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Data urodzenia:** ${wynik.dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${wynik.miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Płeć:** ${wynik.plec}\n` +
                        `<:arrow:1543977081233342494> **Nick Roblox:** ${wynik.nickRoblox}`
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`admin_zrob_edycja_${wynik.userId}`).setLabel('Edytuj jako Admin').setStyle(ButtonStyle.Success).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId(`admin_zrob_usun_${wynik.userId}`).setLabel('Usuń jako Admin').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });
                return;
            }

            if (!interaction.isModalSubmit()) return;

            // Obsługa odrzucenia z powodem
            if (interaction.customId.startsWith('modal_odrzuc_powod_')) {
                await interaction.deferReply({ ephemeral: true });
                const parts = interaction.customId.split('_');
                const targetUserId = parts[4];
                const logMessageId = parts[5];

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
                    await sendDm(interaction.client, targetUserId, '# <a:redtick:1543991522192527450> Wniosek odrzucony\n<:arrow:1543977081233342494> Twój wniosek/prośba o dowód został odrzucony przez administrację.\n<:arrow:1543977081233342494> **Powód:** ${powod}');
                }

                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie odrzucono wniosek i wysłano powód na PV.' });
                return;
            }

            // 1. Złożenie wniosku
            if (interaction.customId === 'modal_dowod_skladanie') {
                await interaction.deferReply({ ephemeral: true });
                const imieNazwisko = interaction.fields.getTextInputValue('dowod_imie').trim();
                const dataUrodzenia = interaction.fields.getTextInputValue('dowod_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('dowod_miejsce').trim();
                const rawPlec = interaction.fields.getTextInputValue('dowod_plec').trim();
                const plec = parsePlec(rawPlec);
                const nickRoblox = interaction.fields.getTextInputValue('dowod_roblox').trim();
                const nickDiscord = interaction.user.tag;

                const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak kanału logów.' });

                const uniqueId = `${interaction.user.id}_${Date.now()}`;
                const payload = {
                    messageId: uniqueId,
                    userId: interaction.user.id,
                    imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord,
                    createdAt: new Date()
                };

                const db = getDb();
                if (db) await db.collection('wnioski_dowody').insertOne({ messageId: uniqueId, dane: payload });
                localWnioskiCache.set(uniqueId, payload);

                const embed = new EmbedBuilder()
                    .setTitle('🪪 Nowy Wniosek o Dowód Tożsamości')
                    .setColor(0x3498db)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Ping:** <@${interaction.user.id}>\n` +
                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                        `<:arrow:1543977081233342494> **Nick Roblox:** ${nickRoblox}\n` +
                        `<:arrow:1543977081233342494> **Nick Discord:** ${nickDiscord}`
                    );

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

                await sendDm(interaction.client, interaction.user.id, '# <a:checkmark:1543969158646206475> Wniosek wysłany\n<:arrow:1543977081233342494> Twój wniosek o dowód tożsamości został wysłany do weryfikacji!');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wniosek został wysłany do weryfikacji!' });
            }

            // 2. Prośba o edycję
            if (interaction.customId === 'modal_dowod_edycja') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const stareDane = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!stareDane) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.' });

                const noweDane = {
                    imieNazwisko: interaction.fields.getTextInputValue('dowod_imie').trim(),
                    dataUrodzenia: interaction.fields.getTextInputValue('dowod_data').trim(),
                    miejsceUrodzenia: interaction.fields.getTextInputValue('dowod_miejsce').trim(),
                    plec: parsePlec(interaction.fields.getTextInputValue('dowod_plec').trim()),
                    nickRoblox: interaction.fields.getTextInputValue('dowod_roblox').trim(),
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
                    .setTitle('✏️ Prośba o Edycję Dowodu')
                    .setColor(0x3498db)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Ping:** <@${interaction.user.id}>\n` +
                        `<:arrow:1543977081233342494> **Nowe Imię i Nazwisko:** ${noweDane.imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Nowa data urodzenia:** ${noweDane.dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Nowe miejsce urodzenia:** ${noweDane.miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Nowa płeć:** ${noweDane.plec}\n` +
                        `<:arrow:1543977081233342494> **Nowy Roblox:** ${noweDane.nickRoblox}\n` +
                        `<:arrow:1543977081233342494> **Data prośby:** ${formatDate(new Date())}`
                    );

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

                await sendDm(interaction.client, interaction.user.id, '# <a:checkmark:1543969158646206475> Prośba o edycję\n<:arrow:1543977081233342494> Twoja prośba o edycję danych została wysłana do administracji.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wysłano prośbę o edycję do administracji.' });
            }

            // 3. Admin: Szukanie dowodu
            if (interaction.customId === 'modal_admin_szukaj') {
                await interaction.deferReply({ ephemeral: true });
                const fraza = interaction.fields.getTextInputValue('szukaj_fraza').trim().toLowerCase();
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.' });

                const dowody = await db.collection('dowody').find({}).toArray();
                const wyniki = dowody.filter(d => 
                    d.userId === fraza || 
                    d.imieNazwisko.toLowerCase().includes(fraza) || 
                    (d.nickRoblox && d.nickRoblox.toLowerCase().includes(fraza))
                );

                if (wyniki.length === 0) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu o podanych kryteriach.' });
                }

                if (wyniki.length === 1) {
                    const wynik = wyniki[0];
                    const embed = new EmbedBuilder()
                        .setTitle(`🪪 Znaleziony Dowód: ${wynik.imieNazwisko}`)
                        .setColor(0x2b2d31)
                        .setDescription(
                            `<:arrow:1543977081233342494> **Ping właściciela:** <@${wynik.userId}>\n` +
                            `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${wynik.imieNazwisko}\n` +
                            `<:arrow:1543977081233342494> **Data urodzenia:** ${wynik.dataUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${wynik.miejsceUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Płeć:** ${wynik.plec}\n` +
                            `<:arrow:1543977081233342494> **Nick Roblox:** ${wynik.nickRoblox}`
                        );

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
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${d.imieNazwisko}`)
                            .setDescription(`Roblox: ${d.nickRoblox} | ID: ${d.userId}`)
                            .setValue(d.userId)
                    );
                });

                const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({
                    content: `# 🔍 Znaleziono **${wyniki.length}** dowody/dowodów\n<:arrow:1543977081233342494> Wybierz osobę z poniższej listy, aby wyświetlić i edytować jej dowód:`,
                    components: [rowSelect]
                });
            }

            // 4. Admin: Ręczne utworzenie dowodu
            if (interaction.customId === 'modal_admin_weryfikuj') {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.fields.getTextInputValue('w_id').trim();
                const imieNazwisko = interaction.fields.getTextInputValue('w_imie').trim();
                const dataUrodzenia = interaction.fields.getTextInputValue('w_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('w_miejsce').trim();
                const plec = parsePlec(interaction.fields.getTextInputValue('w_plec').trim());

                let targetUserTag = "Nieznany";
                try {
                    const fetchedUser = await interaction.client.users.fetch(userId).catch(() => null);
                    if (fetchedUser) targetUserTag = fetchedUser.tag;
                } catch {}

                const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                let sentDowodMsgId = null;

                if (channelDowody) {
                    const embedDowod = new EmbedBuilder()
                        .setTitle(`🪪 Dowód Tożsamości - ${imieNazwisko}`)
                        .setColor(0x2b2d31)
                        .setDescription(
                            `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                            `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                            `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                            `<:arrow:1543977081233342494> **Nick Roblox:** Brak\n` +
                            `<:arrow:1543977081233342494> **Nick Discord:** ${targetUserTag}`
                        );
                    const sentDMsg = await channelDowody.send({ content: `<@${userId}>`, embeds: [embedDowod] });
                    sentDowodMsgId = sentDMsg.id;
                }

                const db = getDb();
                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId },
                        { 
                            $set: { 
                                imieNazwisko, 
                                dataUrodzenia, 
                                miejsceUrodzenia, 
                                plec, 
                                nickRoblox: 'Brak', 
                                nickDiscord: targetUserTag, 
                                verifiedAt: new Date(), 
                                verifiedBy: interaction.user.tag,
                                messageId: sentDowodMsgId
                            } 
                        },
                        { upsert: true }
                    );
                }

                const embedLog = new EmbedBuilder()
                    .setTitle('🛠️ Ręczne Utworzenie Dowodu przez Admina')
                    .setColor(0x57f287)
                    .setDescription(
                        `<:arrow:1543977081233342494> **Właściciel:** <@${userId}> (${targetUserTag})\n` +
                        `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                        `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                        `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                        `<:arrow:1543977081233342494> **Administrator:** ${interaction.user.tag}\n` +
                        `<:arrow:1543977081233342494> **Data:** ${formatDate(new Date())}`
                    );

                const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    await logChannel.send({ embeds: [embedLog] });
                }

                await sendDm(interaction.client, userId, '# <a:checkmark:1543969158646206475> Dowód utworzony\n<:arrow:1543977081233342494> Administrator utworzył dla Ciebie dowód tożsamości.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Ręcznie utworzono dowód tożsamości i opublikowano go na kanale.' });
            }

            // 5. Admin: Edycja bezpośrednia
            if (interaction.customId.startsWith('modal_admin_edytuj_zapisz_')) {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.replace('modal_admin_edytuj_zapisz_', '');
                const db = getDb();
                if (!db) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy danych.' });

                const imieNazwisko = interaction.fields.getTextInputValue('admin_ed_imie').trim();
                const dataUrodzenia = interaction.fields.getTextInputValue('admin_ed_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('admin_ed_miejsce').trim();
                const plec = parsePlec(interaction.fields.getTextInputValue('admin_ed_plec').trim());
                const nickRoblox = interaction.fields.getTextInputValue('admin_ed_roblox').trim();

                const dowod = await db.collection('dowody').findOne({ userId });
                if (!dowod) return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.' });

                await db.collection('dowody').updateOne({ userId }, {
                    $set: { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, updatedAt: new Date() }
                });

                if (dowod.messageId) {
                    const channelDowody = await interaction.client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
                    if (channelDowody) {
                        const msg = await channelDowody.messages.fetch(dowod.messageId).catch(() => null);
                        if (msg) {
                            const newEmbed = new EmbedBuilder()
                                .setTitle(`🪪 Dowód Tożsamości - ${imieNazwisko}`)
                                .setColor(0x2b2d31)
                                .setDescription(
                                    `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                                    `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                                    `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                                    `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                                    `<:arrow:1543977081233342494> **Nick Roblox:** ${nickRoblox}\n` +
                                    `<:arrow:1543977081233342494> **Nick Discord:** ${dowod.nickDiscord}`
                                )
                                .setFooter({ text: `Dane dowodu zostały edytowane przez administratora (${formatDate(new Date())})` });
                            await msg.edit({ embeds: [newEmbed] }).catch(() => {});
                        }
                    }
                }

                await sendDm(interaction.client, userId, '# <a:checkmark:1543969158646206475> Dowód edytowany\n<:arrow:1543977081233342494> Twój dowód został zaktualizowany przez administratora.');
                await sendLog(interaction.client, `# <a:dot:1543969325155745812> **Admin edytował dowód**\n<:arrow:1543977081233342494> **Właściciel:** <@${userId}> | **Admin:** ${interaction.user.tag}`);
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie zaktualizowano dowód użytkownika.' });
            }
        });

        client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;

            if (interaction.customId.startsWith('admin_zrob_usun_')) {
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

                await sendDm(interaction.client, userId, '# <a:redtick:1543991522192527450> Dowód usunięty\n<:arrow:1543977081233342494> Twój dowód został usunięty przez administratora.');
                await sendLog(interaction.client, `# <a:dot:1543969325155745812> **Admin usunął dowód**\n<:arrow:1543977081233342494> **Właściciel:** <@${userId}> | **Admin:** ${interaction.user.tag}`);
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Usunięto dowód użytkownika.' });
            }

            if (interaction.customId.startsWith('admin_zrob_edycja_')) {
                const userId = interaction.customId.replace('admin_zrob_edycja_', '');
                const db = getDb();
                if (!db) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Błąd bazy.', ephemeral: true });

                const dowod = await db.collection('dowody').findOne({ userId });
                if (!dowod) return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu.', ephemeral: true });

                const modal = new ModalBuilder().setCustomId(`modal_admin_edytuj_zapisz_${userId}`).setTitle('Edycja Dowodu (Admin)');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_imie').setLabel('Imię i Nazwisko').setValue(dowod.imieNazwisko).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_data').setLabel('Data urodzenia').setValue(dowod.dataUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_miejsce').setLabel('Miejsce urodzenia').setValue(dowod.miejsceUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_plec').setLabel('Płeć (M / K)').setValue(dowod.plec).setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_ed_roblox').setLabel('Nick Roblox').setValue(dowod.nickRoblox).setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            }
        });
    },

    parsePlec,
    localWnioskiCache
};
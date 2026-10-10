const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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
        if (user) await user.send({ content }).catch(() => {});
    } catch (error) {
        console.error('Błąd wysyłania DM:', error);
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dowod')
        .setDescription('Zaawansowany system dowodów tożsamości.')
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Wysyła publiczny panel zarządzania dowodem dla użytkowników.'))
        .addSubcommand(sub =>
            sub.setName('admin-panel')
                .setDescription('Wysyła panel administracyjny do zarządzania dowodami.')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)),

    async execute(interaction) {
        try {
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
                    .setDescription('Wybierz akcję administracyjną, aby zarządzać dowodami graczy.')
                    .setColor(0x2b2d31);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('admin_dowod_szukaj').setLabel('Znajdź dowód').setStyle(ButtonStyle.Primary).setEmoji('🔎'),
                    new ButtonBuilder().setCustomId('admin_dowod_weryfikuj').setLabel('Ręczna weryfikacja').setStyle(ButtonStyle.Success).setEmoji('🛠️')
                );

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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

            // 1. ZŁÓŻ WNIOSEK (Modal)
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
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            // 2. ZOBACZ DOWÓD
            if (customId === 'dowod_zobacz') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: 'Błąd bazy danych.' });

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

            // 3. EDYTUJ DOWÓD (Modal startowy)
            if (customId === 'dowod_edytuj_start') {
                const db = getDb();
                if (!db) return interaction.reply({ content: 'Błąd bazy danych.', ephemeral: true });

                const dowod = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!dowod) {
                    return interaction.reply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie posiadasz dowodu do edycji.', ephemeral: true });
                }

                const modal = new ModalBuilder().setCustomId('modal_dowod_edycja').setTitle('Prośba o Edycję Dowodu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_imie').setLabel('Imię i Nazwisko').setValue(dowod.imieNazwisko).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_data').setLabel('Data urodzenia').setValue(dowod.dataUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_miejsce').setLabel('Miejsce urodzenia').setValue(dowod.miejsceUrodzenia).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_plec').setLabel('Płeć (M / K)').setValue(dowod.plec).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dowod_roblox').setLabel('Nick Roblox').setValue(dowod.nickRoblox).setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            // 4. USUŃ DOWÓD (Prośba do administracji)
            if (customId === 'dowod_usun_start') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: 'Błąd bazy danych.' });

                const dowod = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!dowod) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie posiadasz dowodu do usunięcia.' });
                }

                const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: 'Nie znaleziono kanału logów.' });

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
                        `<:arrow:1543977081233342494> **Właściciel żąda usunięcia swojego dowodu tożsamości.**\n` +
                        `<:arrow:1543977081233342494> **Data prośby:** ${formatDate(new Date())}`
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_usun_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_usun_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                await channel.send({ embeds: [embed], components: [row] });
                await sendDm(interaction.client, interaction.user.id, '# <a:checkmark:1543969158646206475> Prośba wysłana\n<:arrow:1543977081233342494> Twoja prośba o usunięcie dowodu została przekazana do administracji.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wysłano prośbę o usunięcie dowodu do administracji.' });
                return true;
            }

            // 5. ADMIN: SZUKAJ DOWODU
            if (customId === 'admin_dowod_szukaj') {
                const modal = new ModalBuilder().setCustomId('modal_admin_szukaj').setTitle('Znajdź Dowód Użytkownika');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('szukaj_fraza').setLabel('ID, Imię i Nazwisko lub Roblox').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            // 6. ADMIN: RĘCZNA WERYFIKACJA (Modal)
            if (customId === 'admin_dowod_weryfikuj') {
                const modal = new ModalBuilder().setCustomId('modal_admin_weryfikuj').setTitle('Ręczne Utworzenie Dowodu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_id').setLabel('ID Użytkownika Discord').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_data').setLabel('Data urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_miejsce').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return true;
            }

            // OBSŁUGA PRZYCISKÓW AKCEPTACJI / ODRZUCENIA WNIOSKÓW PRZEZ ADMINA
            const parts = customId.split('_');
            if (parts[0] !== 'dowod') return false;

            const actionType = parts[1]; // akceptuj, odrzuc, adminusun, adminedytuj
            const subAction = parts[2]; // stworz/usun/edycja lub ID
            const targetId = parts.slice(3).join('_');

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const db = getDb();
            const messageId = subAction === 'usun' || subAction === 'edycja' || subAction === 'stworz' ? targetId : subAction;
            
            let wniosek = localWnioskiCache.get(messageId);
            if (!wniosek && db) {
                const found = await db.collection('wnioski_dowody').findOne({ messageId });
                if (found) wniosek = found.dane;
            }

            if (actionType === 'akceptuj') {
                if (subAction === 'stworz') {
                    if (!wniosek) return interaction.editReply({ content: 'Nie znaleziono danych wniosku.' });
                    const { userId, imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord, createdAt } = wniosek;
                    
                    if (db) {
                        await db.collection('dowody').updateOne({ userId }, { $set: { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord, approvedAt: new Date() } }, { upsert: true });
                        await db.collection('wnioski_dowody').deleteOne({ messageId: interaction.message.id });
                    }

                    // Wysyłanie na kanał 1558466596295417996 z pingiem NAD embedem
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
                        const sentDMsg = await channelDowody.send({ content: `<@${userId}>`, embeds: [embedDowod] });
                        sentDowodMsgId = sentDMsg.id;

                        // Zapisz ID wiadomości dowodu w bazie, aby móc ją edytować/usuwać
                        if (db) await db.collection('dowody').updateOne({ userId }, { $set: { messageId: sentDowodMsgId } });
                    }

                    // Edycja embeda logów na zielono
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

                    await sendDm(interaction.client, userId, '# <a:checkmark:1543969158646206475> Wniosek zaakceptowany\n<:arrow:1543977081233342494> Twój wniosek o dowód tożsamości został zatwierdzony przez administrację!');
                    await interaction.editReply({ content: 'Pomyślnie zaakceptowano wniosek.' });

                } else if (subAction === 'usun') {
                    if (!wniosek) return interaction.editReply({ content: 'Nie znaleziono danych.' });
                    const { userId, createdAt, stareDane } = wniosek;

                    if (db) {
                        await db.collection('dowody').deleteOne({ userId });
                        await db.collection('wnioski_dowody').deleteOne({ messageId: interaction.message.id });
                    }

                    // Usunięcie wiadomości z kanału dowodów
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

                    await sendDm(interaction.client, userId, '# <a:checkmark:1543969158646206475> Usunięcie dowodu\n<:arrow:1543977081233342494> Twoja prośba o usunięcie dowodu została zatwierdzona.');
                    await interaction.editReply({ content: 'Zatwierdzono usunięcie dowodu.' });

                } else if (subAction === 'edycja') {
                    if (!wniosek) return interaction.editReply({ content: 'Nie znaleziono danych.' });
                    const { userId, createdAt, stareDane, noweDane } = wniosek;

                    if (db) {
                        await db.collection('dowody').updateOne({ userId }, { 
                            $set: { 
                                imieNazwisko: noweDane.imieNazwisko, 
                                dataUrodzenia: noweDane.dataUrodzenia, 
                                miejsceUrodzenia: noweDane.miejsceUrodzenia, 
                                plec: noweDane.plec, 
                                nickRoblox: noweDane.nickRoblox,
                                updatedAt: new Date() 
                            } 
                        });
                        await db.collection('wnioski_dowody').deleteOne({ messageId: interaction.message.id });
                    }

                    // Edycja wiadomości dowodu na kanale dowodów + footer z datą
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

                    // Logi: Dwa embedy w jednej wiadomości (stary czarny + nowy standardowy)
                    const oldEmbed = new EmbedBuilder()
                        .setTitle('🪪 Dowód przed edycją')
                        .setColor(0x000000)
                        .setDescription(`**Imię i Nazwisko:** ${stareDane.imieNazwisko}\n**Roblox:** ${stareDane.nickRoblox}`);

                    const newEmbedLog = new EmbedBuilder()
                        .setTitle('🪪 Nowy stan dowodu')
                        .setColor(0x57f287)
                        .setDescription(`**Imię i Nazwisko:** ${noweDane.imieNazwisko}\n**Roblox:** ${noweDane.nickRoblox}`)
                        .addFields(
                            { name: 'Data prośby', value: formatDate(createdAt), inline: true },
                            { name: 'Data zaakceptowania', value: formatDate(new Date()), inline: true },
                            { name: 'Zaakceptował', value: interaction.user.tag, inline: true }
                        );

                    await interaction.message.edit({ embeds: [oldEmbed, newEmbedLog], components: [] }).catch(() => {});
                    await sendDm(interaction.client, userId, '# <a:checkmark:1543969158646206475> Edycja zatwierdzona\n<:arrow:1543977081233342494> Twoja prośba o edycję danych dowodu została zaakceptowana.');
                    await interaction.editReply({ content: 'Zatwierdzono edycję dowodu.' });
                }

            } else if (actionType === 'odrzuc') {
                if (db) await db.collection('wnioski_dowody').deleteOne({ messageId: interaction.message.id });
                if (interaction.message.embeds.length > 0) {
                    const origEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(0xed4245)
                        .setTitle('❌ Wniosek / Prośba - ODRZUCONY');
                    await interaction.message.edit({ embeds: [origEmbed], components: [] }).catch(() => {});
                }
                await interaction.editReply({ content: 'Odrzucono pomyślnie.' });
            }

            return true;
        } catch (error) {
            console.error('Błąd button handler:', error);
            try {
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: 'Wystąpił błąd.' });
                else await interaction.reply({ content: 'Wystąpił błąd.', ephemeral: true });
            } catch {}
            return true;
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;

            // 1. SKŁADANIE WNIOSKU
            if (interaction.customId === 'modal_dowod_skladanie') {
                await interaction.deferReply({ ephemeral: true });
                const imieNazwisko = interaction.fields.getTextInputValue('dowod_imie').trim();
                const dataUrodzenia = interaction.fields.getTextInputValue('dowod_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('dowod_miejsce').trim();
                const rawPlec = interaction.fields.getTextInputValue('dowod_plec').trim();
                const plec = parsePlec(rawPlec);
                const nickRoblox = interaction.fields.getTextInputValue('dowod_roblox').trim();
                const nickDiscord = interaction.user.tag;

                const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: 'Brak kanału logów.' });

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
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_stworz_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_stworz_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                const sentMsg = await channel.send({ embeds: [embed], components: [row] });
                if (db) {
                    await db.collection('wnioski_dowody').deleteOne({ messageId: uniqueId });
                    payload.messageId = sentMsg.id;
                    await db.collection('wnioski_dowody').insertOne({ messageId: sentMsg.id, dane: payload });
                }

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_stworz_${sentMsg.id}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_stworz_${sentMsg.id}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );
                await sentMsg.edit({ components: [updatedRow] });

                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wniosek został wysłany do weryfikacji!' });
            }

            // 2. EDYCJA WNIOSEK MODAL
            if (interaction.customId === 'modal_dowod_edycja') {
                await interaction.deferReply({ ephemeral: true });
                const db = getDb();
                if (!db) return interaction.editReply({ content: 'Błąd bazy danych.' });

                const stareDane = await db.collection('dowody').findOne({ userId: interaction.user.id });
                if (!stareDane) return interaction.editReply({ content: 'Nie znaleziono dowodu.' });

                const noweDane = {
                    imieNazwisko: interaction.fields.getTextInputValue('dowod_imie').trim(),
                    dataUrodzenia: interaction.fields.getTextInputValue('dowod_data').trim(),
                    miejsceUrodzenia: interaction.fields.getTextInputValue('dowod_miejsce').trim(),
                    plec: parsePlec(interaction.fields.getTextInputValue('dowod_plec').trim()),
                    nickRoblox: interaction.fields.getTextInputValue('dowod_roblox').trim(),
                    nickDiscord: interaction.user.tag
                };

                const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!channel) return interaction.editReply({ content: 'Brak kanału logów.' });

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
                        `<:arrow:1543977081233342494> **Nowy Roblox:** ${noweDane.nickRoblox}\n` +
                        `<:arrow:1543977081233342494> **Data prośby:** ${formatDate(new Date())}`
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dowod_akceptuj_edycja_${uniqueId}`).setLabel('Zaakceptuj').setStyle(ButtonStyle.Success).setEmoji('1543991524738465853'),
                    new ButtonBuilder().setCustomId(`dowod_odrzuc_edycja_${uniqueId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('1543991522192527450')
                );

                await channel.send({ embeds: [embed], components: [row] });
                await sendDm(client, interaction.user.id, '# <a:checkmark:1543969158646206475> Prośba o edycję\n<:arrow:1543977081233342494> Twoja prośba o edycję danych została wysłana do administracji.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Wysłano prośbę o edycję do administracji.' });
            }

            // 3. ADMIN: WYSZUKIWANIE DOWODU
            if (interaction.customId === 'modal_admin_szukaj') {
                await interaction.deferReply({ ephemeral: true });
                const fraza = interaction.fields.getTextInputValue('szukaj_fraza').trim().toLowerCase();
                const db = getDb();
                if (!db) return interaction.editReply({ content: 'Błąd bazy.' });

                const dowody = await db.collection('dowody').find({}).toArray();
                const wynik = dowody.find(d => 
                    d.userId === fraza || 
                    d.imieNazwisko.toLowerCase().includes(fraza) || 
                    (d.nickRoblox && d.nickRoblox.toLowerCase().includes(fraza))
                );

                if (!wynik) {
                    return interaction.editReply({ content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono dowodu o podanych kryteriach.' });
                }

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
                    new ButtonBuilder().setCustomId(`admin_zrob_usun_${wynik.userId}`).setLabel('Usuń jako Admin').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });
            }

            // 4. ADMIN: RĘCZNE UTWORZENIE
            if (interaction.customId === 'modal_admin_weryfikuj') {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.fields.getTextInputValue('w_id').trim();
                const imieNazwisko = interaction.fields.getTextInputValue('w_imie').trim();
                const dataUrodzenia = interaction.fields.getTextInputValue('w_data').trim();
                const miejsceUrodzenia = interaction.fields.getTextInputValue('w_miejsce').trim();
                const plec = parsePlec(interaction.fields.getTextInputValue('w_plec').trim());

                const db = getDb();
                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId },
                        { $set: { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox: 'Brak', nickDiscord: 'Nieznany', verifiedAt: new Date(), verifiedBy: interaction.user.tag } },
                        { upsert: true }
                    );
                }

                await sendDm(client, userId, '# <a:checkmark:1543969158646206475> Dowód utworzony\n<:arrow:1543977081233342494> Administrator utworzył dla Ciebie dowód tożsamości.');
                await interaction.editReply({ content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Ręcznie utworzono dowód.' });
            }
        });

        // Obsługa przycisku administracyjnego usuwania wyszukanego dowodu
        client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;
            if (!interaction.customId.startsWith('admin_zrob_usun_')) return;

            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.customId.replace('admin_zrob_usun_', '');
            const db = getDb();

            if (db) {
                const dowod = await db.collection('dowody').findOne({ userId });
                if (dowod && dowod.messageId) {
                    const channelDowody = await client.channels.fetch(DOWODY_CHANNEL_ID).catch(() => null);
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
        });
    },

    parsePlec,
    localWnioskiCache
};
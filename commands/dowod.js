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

// Awaryjny magazyn w pamięci podręcznej na wypadek braku bazy
const localWnioskiCache = new Map();

/**
 * Bezpieczna funkcja do wysyłania logów
 */
async function sendLog(client, content) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) await channel.send({ content });
    } catch (error) {
        console.error('Błąd podczas wysyłania logu:', error);
    }
}

/**
 * Funkcja do precyzyjnego wyciągania płci z tekstu wniosku
 */
function parsePlec(text) {
    if (!text) return "Nieznana";
    
    const rawValue = text.trim().toUpperCase();
    if (rawValue.startsWith('K')) return 'K';
    if (rawValue.startsWith('M')) return 'M';

    return "Nieznana";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dowod')
        .setDescription('Zarządzanie systemem dowodów tożsamości.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Wysyła panel składania wniosku o dowód.'))
        .addSubcommand(sub =>
            sub.setName('weryfikuj')
                .setDescription('Ręcznie weryfikuje dowód użytkownika.')
                .addUserOption(opt => opt.setName('uzytkownik').setDescription('Wybierz użytkownika.').setRequired(true))
                .addStringOption(opt => opt.setName('imie_nazwisko').setDescription('Podaj imię i nazwisko.').setRequired(true))
                .addStringOption(opt => opt.setName('plec').setDescription('Podaj płeć (K/M).').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('edytuj')
                .setDescription('Edytuje dane istniejącego dowodu użytkownika.')
                .addUserOption(opt => opt.setName('uzytkownik').setDescription('Wybierz użytkownika.').setRequired(true))
                .addStringOption(opt => opt.setName('imie_nazwisko').setDescription('Nowe imię i nazwisko (opcjonalnie)').setRequired(false))
                .addStringOption(opt => opt.setName('data_urodzenia').setDescription('Nowa data urodzenia (opcjonalnie)').setRequired(false))
                .addStringOption(opt => opt.setName('miejsce_urodzenia').setDescription('Nowe miejsce urodzenia (opcjonalnie)').setRequired(false))
                .addStringOption(opt => opt.setName('plec').setDescription('Nowa płeć M/K (opcjonalnie)').setRequired(false))
                .addStringOption(opt => opt.setName('nick_roblox').setDescription('Nowy nick Roblox (opcjonalnie)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('usun')
                .setDescription('Usuwa dowód tożsamości użytkownika.')
                .addUserOption(opt => opt.setName('uzytkownik').setDescription('Wybierz użytkownika.').setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'panel') {
                const embed = new EmbedBuilder()
                    .setTitle('🪪 Wyrobienie Dowodu Tożsamości')
                    .setDescription('Kliknij poniższy przycisk, aby złożyć wniosek o wyrobienie dowodu tożsamości.')
                    .setColor(0x2b2d31);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('dowod_stworz')
                        .setLabel('Złóż wniosek')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🪪')
                );

                await interaction.reply({ embeds: [embed], components: [row] });

            } else if (subcommand === 'weryfikuj') {
                await interaction.deferReply({ ephemeral: true });

                const targetUser = interaction.options.getUser('uzytkownik');
                const imieNazwisko = interaction.options.getString('imie_nazwisko');
                const rawPlec = interaction.options.getString('plec');
                const plec = parsePlec(rawPlec);

                const db = getDb();
                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId: targetUser.id },
                        { $set: { imieNazwisko, plec, verifiedAt: new Date(), verifiedBy: interaction.user.id } },
                        { upsert: true }
                    );
                }

                await interaction.editReply({ 
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie zweryfikowano dowód dla <@' + targetUser.id + '> (' + imieNazwisko + ', Płeć: ' + plec + ').' 
                });

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Ręczna weryfikacja dowodu**\n<:arrow:1543977081233342494> **Gracz:** <@${targetUser.id}> | **Dane:** ${imieNazwisko} [${plec}] | **Weryfikujący:** ${interaction.user.tag}`
                );

            } else if (subcommand === 'edytuj') {
                await interaction.deferReply({ ephemeral: true });

                const targetUser = interaction.options.getUser('uzytkownik');
                const imieNazwisko = interaction.options.getString('imie_nazwisko');
                const dataUrodzenia = interaction.options.getString('data_urodzenia');
                const miejsceUrodzenia = interaction.options.getString('miejsce_urodzenia');
                const rawPlec = interaction.options.getString('plec');
                const nickRoblox = interaction.options.getString('nick_roblox');

                const db = getDb();
                if (!db) {
                    return interaction.editReply({
                        content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak połączenia z bazą danych.'
                    });
                }

                const existing = await db.collection('dowody').findOne({ userId: targetUser.id });
                if (!existing) {
                    return interaction.editReply({
                        content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Użytkownik nie posiada zarejestrowanego dowodu w bazie.'
                    });
                }

                const updateData = { updatedAt: new Date(), updatedBy: interaction.user.id };
                if (imieNazwisko) updateData.imieNazwisko = imieNazwisko;
                if (dataUrodzenia) updateData.dataUrodzenia = dataUrodzenia;
                if (miejsceUrodzenia) updateData.miejsceUrodzenia = miejsceUrodzenia;
                if (rawPlec) updateData.plec = parsePlec(rawPlec);
                if (nickRoblox) updateData.nickRoblox = nickRoblox;

                await db.collection('dowody').updateOne(
                    { userId: targetUser.id },
                    { $set: updateData }
                );

                await interaction.editReply({
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie zaktualizowano dowód użytkownika <@' + targetUser.id + '>.'
                });

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Edycja dowodu**\n<:arrow:1543977081233342494> **Gracz:** <@${targetUser.id}> | **Edytujący:** ${interaction.user.tag}`
                );

            } else if (subcommand === 'usun') {
                await interaction.deferReply({ ephemeral: true });

                const targetUser = interaction.options.getUser('uzytkownik');
                const db = getDb();

                if (!db) {
                    return interaction.editReply({
                        content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Brak połączenia z bazą danych.'
                    });
                }

                const deleteResult = await db.collection('dowody').deleteOne({ userId: targetUser.id });

                if (deleteResult.deletedCount === 0) {
                    return interaction.editReply({
                        content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Użytkownik nie posiadał dowodu w bazie.'
                    });
                }

                await interaction.editReply({
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie usunięto dowód użytkownika <@' + targetUser.id + '>.'
                });

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Usunięcie dowodu**\n<:arrow:1543977081233342494> **Gracz:** <@${targetUser.id}> | **Usunął:** ${interaction.user.tag}`
                );
            }
        } catch (error) {
            console.error('Błąd w komendzie /dowod:', error);
            const errPayload = { 
                content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd podczas wykonywania tej komendy.', 
                ephemeral: true 
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errPayload).catch(console.error);
            } else {
                await interaction.reply(errPayload).catch(console.error);
            }
        }
    },

    async handleButton(interaction) {
        try {
            const customId = interaction.customId;

            if (customId === 'dowod_stworz') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_dowod_skladanie')
                    .setTitle('Wniosek o Dowód Tożsamości');

                const imieInput = new TextInputBuilder()
                    .setCustomId('dowod_imie')
                    .setLabel('Imię i Nazwisko')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Np. Jan Kowalski')
                    .setRequired(true);

                const dataInput = new TextInputBuilder()
                    .setCustomId('dowod_data')
                    .setLabel('Data urodzenia')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Np. 01.01.2000')
                    .setRequired(true);

                const miejsceInput = new TextInputBuilder()
                    .setCustomId('dowod_miejsce')
                    .setLabel('Miejsce urodzenia')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Np. Warszawa')
                    .setRequired(true);

                const plecInput = new TextInputBuilder()
                    .setCustomId('dowod_plec')
                    .setLabel('Płeć (M / K)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('M lub K')
                    .setRequired(true);

                const robloxInput = new TextInputBuilder()
                    .setCustomId('dowod_roblox')
                    .setLabel('Nick Roblox')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Twój nick w Roblox')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(imieInput),
                    new ActionRowBuilder().addComponents(dataInput),
                    new ActionRowBuilder().addComponents(miejsceInput),
                    new ActionRowBuilder().addComponents(plecInput),
                    new ActionRowBuilder().addComponents(robloxInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            const parts = customId.split('_');
            if (parts[0] !== 'dowod') return false;
            if (parts.length < 3) return false;

            const action = parts[1];
            const messageId = parts.slice(2).join('_');

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            let wniosekData = localWnioskiCache.get(messageId);
            const db = getDb();

            if (!wniosekData && db) {
                wniosekData = await db.collection('wnioski_dowody').findOne({ messageId });
            }

            if (!wniosekData || !wniosekData.dane) {
                await interaction.editReply({
                    content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie odnaleziono danych tego wniosku (mógł wygasnąć lub zostać rozpatrzony po restarcie bota).'
                });
                return true;
            }

            if (action === 'akceptuj') {
                const { userId, imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord } = wniosekData.dane;

                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId },
                        { $set: { imieNazwisko, dataUrodzenia, miejsceUrodzenia, plec, nickRoblox, nickDiscord, approvedAt: new Date() } },
                        { upsert: true }
                    );
                    await db.collection('wnioski_dowody').deleteOne({ messageId });
                }
                localWnioskiCache.delete(messageId);

                if (interaction.message.embeds.length > 0) {
                    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(0x57f287)
                        .setTitle('🪪 Wniosek o Dowód - ZAAKCEPTOWANY');
                    await interaction.message.edit({ embeds: [originalEmbed], components: [] }).catch(() => {});
                }

                await interaction.editReply({ 
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Zaakceptowano wniosek o dowód.'
                });

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Zaakceptowano Dowód**\n<:arrow:1543977081233342494> **Wnioskodawca:** <@${userId}> | **Dane:** ${imieNazwisko} [${plec}] | **Rozpatrujący:** ${interaction.user.tag}`
                );

            } else if (action === 'odrzuc') {
                if (db) {
                    await db.collection('wnioski_dowody').deleteOne({ messageId });
                }
                localWnioskiCache.delete(messageId);

                if (interaction.message.embeds.length > 0) {
                    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(0xed4245)
                        .setTitle('🪪 Wniosek o Dowód - ODRZUCONY');
                    await interaction.message.edit({ embeds: [originalEmbed], components: [] }).catch(() => {});
                }

                await interaction.editReply({ 
                    content: '# <a:redtick:1543991522192527450> Odrzucono\n<:arrow:1543977081233342494> Odrzucono wniosek o dowód.'
                });

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Odrzucono Dowód**\n<:arrow:1543977081233342494> **Wnioskodawca:** <@${wniosekData.dane.userId}> | **Rozpatrujący:** ${interaction.user.tag}`
                );

            } else {
                await interaction.editReply({ 
                    content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nieznana akcja.' 
                });
            }

            return true;

        } catch (error) {
            console.error('Błąd podczas obsługi przycisku w dowod.js:', error);
            const errPayload = { 
                content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd podczas przetwarzania wniosku.', 
                ephemeral: true 
            };
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errPayload);
                } else {
                    await interaction.reply(errPayload);
                }
            } catch (e) {
                console.error('Nie udało się wysłać odpowiedzi o błędzie:', e);
            }
            return true;
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== 'modal_dowod_skladanie') return;

            await interaction.deferReply({ ephemeral: true });

            const imieNazwisko = interaction.fields.getTextInputValue('dowod_imie').trim();
            const dataUrodzenia = interaction.fields.getTextInputValue('dowod_data').trim();
            const miejsceUrodzenia = interaction.fields.getTextInputValue('dowod_miejsce').trim();
            const rawPlec = interaction.fields.getTextInputValue('dowod_plec').trim();
            const plec = parsePlec(rawPlec);
            const nickRoblox = interaction.fields.getTextInputValue('dowod_roblox').trim();
            const nickDiscord = interaction.user.tag;

            const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!channel) {
                return interaction.editReply({
                    content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znalezniono kanału logów/wniosków!'
                });
            }

            const uniqueId = `${interaction.user.id}_${Date.now()}`;
            const wniosekPayload = {
                messageId: uniqueId,
                dane: {
                    userId: interaction.user.id,
                    imieNazwisko,
                    dataUrodzenia,
                    miejsceUrodzenia,
                    plec,
                    nickRoblox,
                    nickDiscord
                },
                createdAt: new Date()
            };

            const db = getDb();
            if (db) {
                await db.collection('wnioski_dowody').insertOne(wniosekPayload);
            }
            localWnioskiCache.set(uniqueId, wniosekPayload);

            const embed = new EmbedBuilder()
                .setTitle('🪪 Nowy Wniosek o Dowód Tożsamości')
                .setColor(0x3498db)
                .setDescription(
                    `<:arrow:1543977081233342494> **Wnioskodawca:** <@${interaction.user.id}>\n` +
                    `<:arrow:1543977081233342494> **Imię i Nazwisko:** ${imieNazwisko}\n` +
                    `<:arrow:1543977081233342494> **Data urodzenia:** ${dataUrodzenia}\n` +
                    `<:arrow:1543977081233342494> **Miejsce urodzenia:** ${miejsceUrodzenia}\n` +
                    `<:arrow:1543977081233342494> **Płeć:** ${plec}\n` +
                    `<:arrow:1543977081233342494> **Nick Roblox:** ${nickRoblox}\n` +
                    `<:arrow:1543977081233342494> **Nick Discord:** ${nickDiscord}`
                )
                .setTimestamp();

            // Użycie idealnej pary: greentick do akceptacji oraz redtick do odrzucenia
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dowod_akceptuj_${uniqueId}`)
                    .setLabel('Zaakceptuj')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('1543991524738465853'), // greentick
                new ButtonBuilder()
                    .setCustomId(`dowod_odrzuc_${uniqueId}`)
                    .setLabel('Odrzuć')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('1543991522192527450') // redtick
            );

            const sentMessage = await channel.send({ embeds: [embed], components: [row] });

            if (db) {
                await db.collection('wnioski_dowody').deleteOne({ messageId: uniqueId });
                wniosekPayload.messageId = sentMessage.id;
                await db.collection('wnioski_dowody').insertOne(wniosekPayload);
            }
            localWnioskiCache.delete(uniqueId);
            localWnioskiCache.set(sentMessage.id, wniosekPayload);

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dowod_akceptuj_${sentMessage.id}`)
                    .setLabel('Zaakceptuj')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('1543991524738465853'), // greentick
                new ButtonBuilder()
                    .setCustomId(`dowod_odrzuc_${sentMessage.id}`)
                    .setLabel('Odrzuć')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('1543991522192527450') // redtick
            );
            await sentMessage.edit({ components: [updatedRow] });

            await interaction.editReply({
                content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Twój wniosek o dowód został pomyślnie wysłany do weryfikacji przez administrację!'
            });
        });
    },

    parsePlec,
    localWnioskiCache
};
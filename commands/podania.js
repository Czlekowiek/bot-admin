const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    MessageFlags 
} = require('discord.js');
// POPRAWKA: Zmieniono ścieżkę z '../utils/db' na '../utils/database'
const { getDb } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('podania')
        .setDescription('Zarządzanie systemem podań i rekrutacji')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Wysyła panel z przyciskami rekrutacyjnymi do frakcji'))
        .addSubcommand(sub =>
            sub.setName('ustaw')
                .setDescription('Konfiguruje link rekrutacyjny dla danej frakcji')
                .addStringOption(opt => 
                    opt.setName('frakcja')
                        .setDescription('Identyfikator lub nazwa frakcji')
                        .setRequired(true))
                .addStringOption(opt => 
                    opt.setName('link')
                        .setDescription('Pełny link do formularza (musi zaczynać się od https://)')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            // 1. Podkomenda: PANEL (Tworzenie embeda z przyciskami do podania)
            if (subcommand === 'panel') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const db = getDb();
                if (!db) {
                    return interaction.editReply({ content: 'Brak połączenia z bazą danych.' });
                }

                const frakcje = await db.collection('frakcje').find({}).toArray();
                if (!frakcje || frakcje.length === 0) {
                    return interaction.editReply({ content: 'Nie skonfigurowano jeszcze żadnych frakcji w bazie danych.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle('Rekrutacja do Frakcji')
                    .setDescription('Wybierz frakcję poniżej, aby otworzyć formularz rekrutacyjny.')
                    .setColor(0x3498db)
                    .setFooter({ text: 'System rekrutacji' });

                const row = new ActionRowBuilder();
                let addedButtons = 0;

                for (const frakcja of frakcje) {
                    if (addedButtons >= 25) break;

                    const customId = `podania_open_${frakcja.id}`.slice(0, 100);

                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(customId)
                            .setLabel(frakcja.nazwa || frakcja.id)
                            .setStyle(ButtonStyle.Primary)
                    );
                    addedButtons++;
                }

                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: 'Panel rekrutacyjny został wysłany na ten kanał.' });

            // 2. Podkomenda: USTAWIENIA FRAKCJI
            } else if (subcommand === 'ustaw') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const frakcjaId = interaction.options.getString('frakcja').toLowerCase().trim();
                const link = interaction.options.getString('link').trim();

                if (!link.startsWith('https://') && !link.startsWith('http://')) {
                    return interaction.editReply({ content: 'Podany link jest nieprawidłowy! Link musi rozpoczynać się od https://.' });
                }

                const db = getDb();
                if (!db) {
                    return interaction.editReply({ content: 'Brak połączenia z bazą danych. Zmiany nie zostały zapisane.' });
                }

                const result = await db.collection('frakcje').updateOne(
                    { id: frakcjaId },
                    { $set: { id: frakcjaId, link: link, updatedAt: new Date(), updatedBy: interaction.user.id } },
                    { upsert: true }
                );

                if (!result.acknowledged) {
                    return interaction.editReply({ content: 'Błąd zapisu w bazie danych. Spróbuj ponownie później.' });
                }

                await interaction.editReply({ content: `Zaktualizowano link rekrutacyjny dla frakcji **${frakcjaId}**.` });
            }
        } catch (error) {
            console.error('Błąd podczas wykonywania komendy /podania:', error);
            const errPayload = { content: 'Wystąpił błąd podczas obsługi systemu podań.', flags: MessageFlags.Ephemeral };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errPayload).catch(console.error);
            } else {
                await interaction.reply(errPayload).catch(console.error);
            }
        }
    },

    /**
     * Obsługa kliknięć przycisków w panelu podań
     */
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;
            const parts = customId.split('_');

            const action = parts[0] === 'podania' ? parts[1] : parts[0];
            const frakcjaId = parts[parts.length - 1];

            if (action === 'open') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const db = getDb();
                if (!db) {
                    return interaction.editReply({ content: 'Wystąpił błąd podczas łączenia z bazą danych.' });
                }

                const frakcja = await db.collection('frakcje').findOne({ id: frakcjaId });

                if (!frakcja || !frakcja.link) {
                    return interaction.editReply({ 
                        content: 'Rekrutacja do tej frakcji została wyłączona lub frakcja została usunięta z bazy danych.' 
                    });
                }

                await interaction.editReply({ 
                    content: `Link do formularza rekrutacyjnego frakcji **${frakcja.nazwa || frakcjaId}**:\n${frakcja.link}` 
                });

            } else if (action === 'edit') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const db = getDb();
                if (!db) {
                    return interaction.editReply({ content: 'Błąd połączenia z bazą danych.' });
                }

                const frakcja = await db.collection('frakcje').findOne({ id: frakcjaId });

                if (!frakcja) {
                    return interaction.editReply({ 
                        content: 'Nie znaleziono danych o tej frakcji w bazie danych.' 
                    });
                }

                await interaction.editReply({
                    content: `Edycja frakcji **${frakcjaId}**. Użyj komendy \`/podania ustaw frakcja:${frakcjaId} link:NOWY_LINK\`, aby zaktualizować adres URL.`
                });
            }
        } catch (error) {
            console.error('Błąd w handlerze przycisków podania.js:', error);
            const errPayload = { content: 'Wystąpił nieoczekiwany błąd podczas przetwarzania żądania.', flags: MessageFlags.Ephemeral };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errPayload).catch(console.error);
            } else {
                await interaction.reply(errPayload).catch(console.error);
            }
        }
    },

    // DODANE: Rejestracja eventu dla przycisków
    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;
            if (interaction.customId.startsWith('podania_') || interaction.customId.startsWith('edit_')) {
                await module.exports.handleButton(interaction);
            }
        });
    }
};
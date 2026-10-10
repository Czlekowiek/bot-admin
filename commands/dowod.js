const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const { getDb } = require('../utils/database');

// Awaryjny magazyn w pamięci podręcznej na wypadek braku bazy
const localWnioskiCache = new Map();

/**
 * Funkcja do precyzyjnego wyciągania płci z tekstu wniosku
 */
function parsePlec(text) {
    if (!text) return "Nieznana";
    
    const match = text.match(/Płeć:\s*([^\n]+)/i);
    if (!match) return "Nieznana";

    const rawValue = match[1].trim().toUpperCase();
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
                .addStringOption(opt => opt.setName('plec').setDescription('Podaj płeć (K/M).').setRequired(true))),

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
                const plec = parsePlec(`Płeć: ${rawPlec}`);

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

                if (typeof interaction.client.sendLog === 'function') {
                    await interaction.client.sendLog(
                        interaction.guild,
                        'Ręczna weryfikacja dowodu',
                        `**Gracz:** <@${targetUser.id}>\n**Dane:** ${imieNazwisko} [${plec}]\n**Weryfikujący:** ${interaction.user.tag}`
                    );
                }
            }
        } catch (error) {
            console.error('Błąd w komendzie /dowod:', error);
            const errPayload = { 
                content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd podczas wykonywania tej komendy.', 
                ephemeral: true 
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errPayload).catch(console.error);
            } else {
                await interaction.reply(errPayload).catch(console.error);
            }
        }
    },

    /**
     * Obsługa interakcji przycisków wniosek / akceptuj / odrzuć
     */
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;

            if (customId === 'dowod_stworz') {
                await interaction.reply({
                    content: '# <a:checkmark:1543969158646206475> Wniosek\n<:arrow:1543977081233342494> Funkcja formularza jest aktywna. Prześlij swoje dane do weryfikacji.',
                    ephemeral: true
                });
                return true;
            }

            const [prefix, action, messageId] = customId.split('_');
            if (prefix !== 'dowod') return false;

            await interaction.deferReply({ ephemeral: true });

            // 1. Pobranie danych wniosku z bazy lub pamięci podręcznej
            let wniosekData = localWnioskiCache.get(messageId);
            const db = getDb();

            if (!wniosekData && db) {
                wniosekData = await db.collection('wnioski_dowody').findOne({ messageId: messageId });
            }

            // 2. Odporność na brak danych po restarcie bota
            if (!wniosekData || !wniosekData.dane) {
                await interaction.editReply({
                    content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie odnaleziono danych tego wniosku w bazie danych (wniosek mógł wygasnąć lub zostać rozpatrzony po zrestartowaniu bota).'
                });
                return true;
            }

            if (action === 'akceptuj') {
                const { userId, imieNazwisko, plec } = wniosekData.dane;

                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId: userId },
                        { $set: { imieNazwisko, plec, approvedAt: new Date() } },
                        { upsert: true }
                    );
                    await db.collection('wnioski_dowody').deleteOne({ messageId: messageId });
                }
                localWnioskiCache.delete(messageId);

                // Aktualizacja embeda wiadomości
                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x57f287)
                    .setTitle('🪪 Wniosek o Dowód - ZAAKCEPTOWANY');

                await interaction.message.edit({ embeds: [originalEmbed], components: [] });
                await interaction.editReply({ 
                    content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Zaakceptowano wniosek o dowód.' 
                });

                if (typeof interaction.client.sendLog === 'function') {
                    await interaction.client.sendLog(
                        interaction.guild,
                        'Zaakceptowano Dowód',
                        `**Wnioskodawca:** <@${userId}>\n**Dane:** ${imieNazwisko} [${plec}]\n**Rozpatrujący:** ${interaction.user.tag}`
                    );
                }

            } else if (action === 'odrzuc') {
                if (db) {
                    await db.collection('wnioski_dowody').deleteOne({ messageId: messageId });
                }
                localWnioskiCache.delete(messageId);

                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0xed4245)
                    .setTitle('🪪 Wniosek o Dowód - ODRZUCONY');

                await interaction.message.edit({ embeds: [originalEmbed], components: [] });
                await interaction.editReply({ 
                    content: '# <a:redtick:1543991522192527450> Odrzucono\n<:arrow:1543977081233342494> Odrzucono wniosek o dowód.' 
                });

                if (typeof interaction.client.sendLog === 'function') {
                    await interaction.client.sendLog(
                        interaction.guild,
                        'Odrzucono Dowód',
                        `**Wnioskodawca:** <@${wniosekData.dane.userId}>\n**Rozpatrujący:** ${interaction.user.tag}`
                    );
                }
            }
            return true;
        } catch (error) {
            console.error('Błąd podczas obsługi przycisku w dowod.js:', error);
            const errPayload = { 
                content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Wystąpił błąd podczas przetwarzania wniosku.', 
                ephemeral: true 
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errPayload).catch(console.error);
            } else {
                await interaction.reply(errPayload).catch(console.error);
            }
            return true;
        }
    },

    parsePlec,
    localWnioskiCache
};
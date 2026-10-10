const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
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

                await sendLog(
                    interaction.client,
                    `# <a:dot:1543969325155745812> **Ręczna weryfikacja dowodu**\n<:arrow:1543977081233342494> **Gracz:** <@${targetUser.id}> | **Dane:** ${imieNazwisko} [${plec}] | **Weryfikujący:** ${interaction.user.tag}`
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
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({
                    content: '# <a:checkmark:1543969158646206475> Wniosek\n<:arrow:1543977081233342494> Funkcja formularza jest aktywna. Prześlij swoje dane do weryfikacji.'
                });
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
                const { userId, imieNazwisko, plec } = wniosekData.dane;

                if (db) {
                    await db.collection('dowody').updateOne(
                        { userId },
                        { $set: { imieNazwisko, plec, approvedAt: new Date() } },
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

    parsePlec,
    localWnioskiCache
};
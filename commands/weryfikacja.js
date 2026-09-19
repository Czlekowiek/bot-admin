const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const captchaStorage = new Map();

const ROLA_NIEZWERYFIKOWANY = '1550876638013685901';
const ROLA_ZWERYFIKOWANY = '1542126972669403178';
const KANAL_WERYFIKACJI = '1544013529353294004';

function generateRandomDigits() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja-setup')
        .setDescription('Wysyła wiadomość weryfikacyjną i ukrywa istniejące kanały dla niezweryfikowanych')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const channel = await guild.channels.fetch(KANAL_WERYFIKACJI).catch(() => null);
        if (!channel) {
            return interaction.editReply('❌ Nie znaleziono kanału weryfikacji o podanym ID!');
        }

        // 1. Zmiana permisji na WSZYSTKICH istniejących kanałach (oprócz weryfikacji)
        let updatedChannels = 0;
        for (const [chId, chObj] of guild.channels.cache) {
            if (chId === KANAL_WERYFIKACJI) continue;
            try {
                await chObj.permissionOverwrites.create(ROLA_NIEZWERYFIKOWANY, {
                    ViewChannel: false
                });
                updatedChannels++;
            } catch (error) {
                console.error(`Nie udało się zaktualizować permisji dla kanału ${chObj.name}:`, error);
            }
        }

        // 2. Wysłanie wiadomości weryfikacyjnej
        const embed = new EmbedBuilder()
            .setColor(0xFFCE00)
            .setDescription(
                `# <:verified:1543971649433641050> Weryfikacja\n\n` +
                `## Aby się zweryfikować, kliknij przycisk "Zweryfikuj" pod tą wiadomością i przepisz kod z okienka.`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_verification_modal')
                .setLabel('Zweryfikuj')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛡️')
        );

        await channel.send({ embeds: [embed], components: [row] });

        return interaction.editReply(`✅ Pomyślnie wysłano panel weryfikacyjny oraz ukryto **${updatedChannels}** istniejących kanałów przed rolą niezweryfikowanych!`);
    },

    setupEvents(client) {
        // Automatyczna rola po dołączeniu na serwer
        client.on('guildMemberAdd', async member => {
            try {
                await member.roles.add(ROLA_NIEZWERYFIKOWANY);
            } catch (error) {
                console.error('Nie udało się nadać roli niezweryfikowanego:', error);
            }
        });

        // Automatyczne ukrywanie nowo tworzonych kanałów
        client.on('channelCreate', async channel => {
            if (!channel.guild) return;
            if (channel.id === KANAL_WERYFIKACJI) return;

            try {
                await channel.permissionOverwrites.create(ROLA_NIEZWERYFIKOWANY, {
                    ViewChannel: false
                });
            } catch (error) {
                console.error('Nie udało się ustawić permisji dla nowego kanału:', error);
            }
        });

        // Obsługa modala i przycisku
        client.on('interactionCreate', async interaction => {
            if (interaction.isButton() && interaction.customId === 'start_verification_modal') {
                const code = generateRandomDigits();
                captchaStorage.set(interaction.user.id, code);

                const modal = new ModalBuilder()
                    .setCustomId('verification_modal_submit')
                    .setTitle('Weryfikacja Captcha');

                const input = new TextInputBuilder()
                    .setCustomId('verification_code_input')
                    .setLabel(`Przepisz te cyfry: [ ${code} ]`)
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(5)
                    .setMaxLength(5)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && interaction.customId === 'verification_modal_submit') {
                const userInput = interaction.fields.getTextInputValue('verification_code_input').trim();
                const expectedCode = captchaStorage.get(interaction.user.id);

                if (!expectedCode || userInput !== expectedCode) {
                    return interaction.reply({ content: '❌ Błędny kod! Kliknij przycisk "Zweryfikuj" ponownie.', ephemeral: true });
                }

                captchaStorage.delete(interaction.user.id);

                const member = interaction.member;
                try {
                    if (member.roles.cache.has(ROLA_NIEZWERYFIKOWANY)) {
                        await member.roles.remove(ROLA_NIEZWERYFIKOWANY);
                    }
                    await member.roles.add(ROLA_ZWERYFIKOWANY);

                    return interaction.reply({ content: '✅ Pomyślnie przeszperano weryfikację! Witaj na serwerze.', ephemeral: true });
                } catch (error) {
                    console.error('Błąd podczas zmiany ról weryfikacji:', error);
                    return interaction.reply({ content: '❌ Wystąpił błąd podczas nadawania ról. Powiadom administrację.', ephemeral: true });
                }
            }
        });
    }
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { sendLog } = require('../utils/logs');

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

        const channels = await guild.channels.fetch();
        let updatedChannels = 0;

        for (const [chId, chObj] of channels) {
            if (!chObj || chId === KANAL_WERYFIKACJI) continue;
            if (chObj.isThread && chObj.isThread()) continue;

            try {
                await chObj.permissionOverwrites.edit(ROLA_NIEZWERYFIKOWANY, { ViewChannel: false });
                updatedChannels++;
            } catch (error) {}
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFCE00)
            .setDescription(`# Weryfikacja\n\n## Aby się zweryfikować, kliknij przycisk "Zweryfikuj", przepisz kod weryfikacyjny i kliknij "wyślij".`)
            .setFooter({ text: 'W razie problemów z weryfikacją, napisz wiadomość prywatną do @czlekowiek' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_verification_modal')
                .setLabel('Zweryfikuj')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });

        await sendLog(interaction.client, {
            title: 'Skonfigurowano Panel Weryfikacji',
            description: `Wysłano panel weryfikacyjny na kanał <#${KANAL_WERYFIKACJI}> i zaktualizowano uprawnienia dla${updatedChannels} kanałów.`,
            color: 0x2ecc71,
            executor: interaction.user
        });

        return interaction.editReply(`✅ Pomyślnie wysłano panel weryfikacyjny oraz zaktualizowano uprawnienia dla **${updatedChannels}** kanałów!`);
    },

    setupEvents(client) {
        client.on('guildMemberAdd', async member => {
            try {
                await member.roles.add(ROLA_NIEZWERYFIKOWANY).catch(() => {});
            } catch (error) {}
        });

        client.on('channelCreate', async channel => {
            if (!channel.guild || channel.id === KANAL_WERYFIKACJI) return;
            if (channel.isThread && channel.isThread()) return;

            try {
                await channel.permissionOverwrites.edit(ROLA_NIEZWERYFIKOWANY, { ViewChannel: false });
            } catch (error) {}
        });

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
                await interaction.deferReply({ ephemeral: true });

                const userInput = interaction.fields.getTextInputValue('verification_code_input').trim();
                const expectedCode = captchaStorage.get(interaction.user.id);

                if (!expectedCode || userInput !== expectedCode) {
                    await sendLog(interaction.client, {
                        title: 'Błąd Weryfikacji (Błędny Kod)',
                        description: `Użytkownik wpisał błędny kod captcha.\n\n• **Użytkownik:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n• **Wpisany kod:** \`${userInput}\`\n• **Oczekiwany kod:** \`${expectedCode}\``,
                        color: 0xe74c3c,
                        executor: interaction.user
                    });
                    return interaction.editReply({ content: 'Błędny kod! Kliknij przycisk "Zweryfikuj" ponownie.' });
                }

                captchaStorage.delete(interaction.user.id);
                const member = interaction.member;

                try {
                    if (member.roles.cache.has(ROLA_NIEZWERYFIKOWANY)) {
                        await member.roles.remove(ROLA_NIEZWERYFIKOWANY);
                    }
                    await member.roles.add(ROLA_ZWERYFIKOWANY);

                    await sendLog(interaction.client, {
                        title: 'Pomyślna Weryfikacja',
                        description: `Użytkownik pomyślnie ukończył weryfikację i otrzymał odpowiednie role.\n\n• **Użytkownik:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
                        color: 0x2ecc71,
                        executor: interaction.user
                    });

                    return interaction.editReply({ content: 'Pomyślnie zweryfikowano! Witaj na serwerze.' });
                } catch (error) {
                    await sendLog(interaction.client, {
                        title: 'Błąd Ról podczas Weryfikacji',
                        description: `Nie udało się nadać ról użytkownikowi <@${interaction.user.id}>.`,
                        color: 0xe74c3c,
                        executor: interaction.user
                    });
                    return interaction.editReply({ content: 'Wystąpił błąd podczas nadawania ról. Powiadom administrację.' });
                }
            }
        });
    }
};

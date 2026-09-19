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
            .setDescription(`# <:verify_green:1548654937620222052> Weryfikacja\n\n## Aby się zweryfikować, kliknij przycisk "<:verify_green:1548654937620222052> Zweryfikuj", przepisz kod weryfikacyjny i kliknij "wyślij".`)
            .setFooter({ text: 'W razie problemów z weryfikacją, napisz wiadomość prywatną do @czlekowiek' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_verification_modal')
                .setLabel('Zweryfikuj')
                .setStyle(ButtonStyle.Success)
                .setEmoji('<:verify_green:1548654937620222052>')
        );

        await channel.send({ embeds: [embed], components: [row] });

        // Logowanie akcji setupu weryfikacji z nową spójną emotką
        try {
            if (interaction.client && typeof interaction.client.sendLog === 'function') {
                await interaction.client.sendLog(`<a:neon_staff:1550909470605844650> Użytkownik **${interaction.user.tag}** skonfigurował panel weryfikacji na kanale <#${KANAL_WERYFIKACJI}> (zaktualizowano uprawnienia dla ${updatedChannels} kanałów).`);
            }
        } catch (err) {
            console.error('Błąd logowania weryfikacji setup:', err);
        }

        return interaction.editReply(`✅ Pomyślnie wysłano panel weryfikacyjny oraz zaktualizowano uprawnienia dla **${updatedChannels}** kanałów!`);
    },

    setupEvents(client) {
        // Automatyczne nadawanie roli po dołączeniu
        client.on('guildMemberAdd', async member => {
            try {
                await member.roles.add(ROLA_NIEZWERYFIKOWANY).catch(() => {});
                if (typeof client.sendLog === 'function') {
                    await client.sendLog(`<a:greentick:1543991524738465853> Nowy użytkownik **${member.user.tag}** dołączył na serwer - nadano rolę niezweryfikowanego.`);
                }
            } catch (error) {}
        });

        // Ukrywanie nowo tworzonych kanałów dla niezweryfikowanych
        client.on('channelCreate', async channel => {
            if (!channel.guild || channel.id === KANAL_WERYFIKACJI) return;
            if (channel.isThread && channel.isThread()) return;

            try {
                await channel.permissionOverwrites.edit(ROLA_NIEZWERYFIKOWANY, { ViewChannel: false });
            } catch (error) {}
        });

        // Obsługa interakcji weryfikacji (Przycisk i Modal)
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
                    try {
                        if (typeof client.sendLog === 'function') {
                            await client.sendLog(`<a:redtick:1543991522192527450> Użytkownik **${interaction.user.tag}** podał błędny kod weryfikacyjny (\`${userInput}\`, oczekiwano: \`${expectedCode}\`).`);
                        }
                    } catch (e) {}

                    return interaction.editReply({ content: '<a:redtick:1543991522192527450> Błędny kod! Kliknij przycisk "Zweryfikuj" ponownie.' });
                }

                captchaStorage.get(interaction.user.id); // lub delete
                captchaStorage.delete(interaction.user.id);
                const member = interaction.member;

                try {
                    if (member.roles.cache.has(ROLA_NIEZWERYFIKOWANY)) {
                        await member.roles.remove(ROLA_NIEZWERYFIKOWANY);
                    }
                    await member.roles.add(ROLA_ZWERYFIKOWANY);

                    try {
                        if (typeof client.sendLog === 'function') {
                            await client.sendLog(`<a:greentick:1543991524738465853> Użytkownik **${interaction.user.tag}** pomyślnie przeszedł weryfikację!`);
                        }
                    } catch (e) {}

                    return interaction.editReply({ content: '<a:greentick:1543991524738465853> Pomyślnie zweryfikowano! Witaj na serwerze.' });
                } catch (error) {
                    return interaction.editReply({ content: '<a:redtick:1543991522192527450> Wystąpił błąd podczas nadawania ról. Powiadom administrację.' });
                }
            }
        });
    }
};

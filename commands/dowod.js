const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const dowodyDB = new Map();
const wnioskiDB = new Map();

const KANAL_WNIOSKOW = '1549106534561218722';
const KANAL_DOWODOW = '1548821312166699028';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dowod')
        .setDescription('Zarządzanie dowodem osobistym')
        .addSubcommand(sub =>
            sub.setName('stworz').setDescription('Tworzy wniosek o dowód osobisty'))
        .addSubcommand(sub =>
            sub.setName('pokaz').setDescription('Pokazuje Twój dowód osobisty'))
        .addSubcommand(sub =>
            sub.setName('edytuj').setDescription('Edytuje dane w dowodzie (wymaga zgody admina)'))
        .addSubcommand(sub =>
            sub.setName('usun').setDescription('Usuwa dowód osobisty (wymaga zgody admina)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'stworz') {
            if (dowodyDB.has(userId)) {
                return interaction.reply({ content: '❌ Masz już aktywny dowód osobisty!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_dowod_stworz')
                .setTitle('Tworzenie Dowodu Osobistego');

            // Discord pozwala na max 5 pól w modalu. Nick Discord jest pobierany automatycznie z Twojego konta.
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Data urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Płeć (M/K)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true))
            );

            return await interaction.showModal(modal);
        }

        if (subcommand === 'pokaz') {
            const dowod = dowodyDB.get(userId);
            if (!dowod) {
                return interaction.reply({ content: '❌ Nie posiadasz jeszcze zatwierdzonego dowodu osobistego! Możesz go utworzyć za pomocą `/dowod stworz`.', ephemeral: true });
            }

            return interaction.reply({ content: `Oto Twój dowód: ${dowod.linkWiadomosci}`, ephemeral: true });
        }

        if (subcommand === 'edytuj') {
            if (!dowodyDB.has(userId)) {
                return interaction.reply({ content: '❌ Nie posiadasz dowodu do edycji!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_dowod_edytuj')
                .setTitle('Edycja Dowodu Osobistego');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Nowe Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Nowa data urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Nowe miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Nowa płeć (M/K)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roblox').setLabel('Nowy Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true))
            );

            return await interaction.showModal(modal);
        }

        if (subcommand === 'usun') {
            const dowod = dowodyDB.get(userId);
            if (!dowod) {
                return interaction.reply({ content: '❌ Nie posiadasz dowodu do usunięcia!', ephemeral: true });
            }

            const channel = await interaction.guild.channels.fetch(KANAL_WNIOSKOW).catch(() => null);
            if (!channel) return interaction.reply({ content: '❌ Błąd kanału wniosków.', ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dowod_usun_tak_${userId}`).setLabel('Potwierdź usunięcie').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`dowod_usun_nie_${userId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Secondary)
            );

            const msg = await channel.send({
                content: `⚠️ **WNIOSEK O USUNIĘCIE DOWODU** od <@${userId}>`,
                components: [row]
            });

            wnioskiDB.set(msg.id, { type: 'usun', userId });
            return interaction.reply({ content: 'Wysłano wniosek o usunięcie dowodu do akceptacji przez administrację.', ephemeral: true });
        }
    },

    dowodyDB,
    wnioskiDB,
    KANAL_WNIOSKOW,
    KANAL_DOWODOW
};

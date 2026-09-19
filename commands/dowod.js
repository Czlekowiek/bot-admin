const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const dowodyDB = new Map();
const wnioskiDB = new Map();
const tymczasoweDane = new Map();
const KANAL_WNIOSKOW = '1549106534561218722';
const KANAL_DOWODOW = '1548821312166699028';

async function pobierzLubOdzyskajDowod(guild, userId) {
    if (dowodyDB.has(userId)) return dowodyDB.get(userId);
    const kanalDowodow = await guild.channels.fetch(KANAL_DOWODOW).catch(() => null);
    if (!kanalDowodow) return null;
    const messages = await kanalDowodow.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) return null;
    const msg = messages.find(m => m.content.includes(userId));
    if (msg) {
        const lines = msg.content.split('\n');
        const dane = {
            imie: lines.find(l => l.startsWith('Imię i Nazwisko:'))?.replace('Imię i Nazwisko: ', '').trim() || '',
            data_ur: lines.find(l => l.startsWith('Data urodzenia:'))?.replace('Data urodzenia: ', '').trim() || '',
            miejsce_ur: lines.find(l => l.startsWith('Miejsce urodzenia:'))?.replace('Miejsce urodzenia: ', '').trim() || '',
            plec: lines.find(l => l.startsWith('Płeć:'))?.replace(/Płeć:.*?(M\/K)?/, '').replace('(', '').replace(')', '').trim() || 'M/K',
            roblox: lines.find(l => l.startsWith('Nick Roblox:'))?.replace('Nick Roblox: ', '').trim() || '',
            discord: lines.find(l => l.startsWith('Nick Discord:'))?.replace('Nick Discord: ', '').trim() || '',
            praca: lines.find(l => l.startsWith('Aktualna praca:'))?.replace('Aktualna praca: ', '').trim() || ''
        };
        const dowodObj = { wiadomoscId: msg.id, linkWiadomosci: msg.url, dane };
        dowodyDB.set(userId, dowodObj);
        return dowodObj;
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dowod')
        .setDescription('Zarządzanie dowodem osobistym')
        .addSubcommand(sub => sub.setName('stworz').setDescription('Tworzy wniosek o dowód osobisty'))
        .addSubcommand(sub => sub.setName('pokaz').setDescription('Pokazuje Twój dowód osobisty'))
        .addSubcommand(sub => sub.setName('edytuj').setDescription('Edytuje dane w dowodzie (wymaga zgody admina)'))
        .addSubcommand(sub => sub.setName('usun').setDescription('Usuwa dowód osobisty (wymaga zgody admina)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'stworz') {
            if (await pobierzLubOdzyskajDowod(interaction.guild, userId)) {
                return interaction.reply({ content: '❌ Masz już aktywny dowód osobisty! Użyj opcji edycji lub usuń obecny.', ephemeral: true });
            }
            const modal = new ModalBuilder().setCustomId('modal_dowod_krok1').setTitle('Tworzenie dowodu: Dane (1/2)');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Data urodzenia (np. 01.01.2000)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('praca').setLabel('Aktualna praca').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (subcommand === 'pokaz') {
            const dowod = dowodyDB.get(userId) || await pobierzLubOdzyskajDowod(interaction.guild, userId);
            if (!dowod) {
                return interaction.reply({ content: '❌ Nie posiadasz jeszcze zatwierdzonego dowodu osobistego! Możesz go utworzyć za pomocą `/dowod stworz`.', ephemeral: true });
            }
            return interaction.reply({ content: `Oto Twój dowód: ${dowod.linkWiadomosci}`, ephemeral: true });
        }

        if (subcommand === 'edytuj') {
            const istniejacyDowod = dowodyDB.get(userId) || await pobierzLubOdzyskajDowod(interaction.guild, userId);
            if (!istniejacyDowod) {
                return interaction.reply({ content: '❌ Nie masz jeszcze swojego dowodu osobistego, więc nie masz czego edytować.', ephemeral: true });
            }
            const istniejacy = istniejacyDowod.dane;
            const modal = new ModalBuilder().setCustomId('modal_dowod_edytuj_krok1').setTitle('Edycja dowodu: Dane (1/2)');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Imię i Nazwisko').setValue(istniejacy.imie || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Data urodzenia').setValue(istniejacy.data_ur || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Miejsce urodzenia').setValue(istniejacy.miejsce_ur || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Płeć (M / K)').setValue(istniejacy.plec || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('praca').setLabel('Aktualna praca').setValue(istniejacy.praca || '').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (subcommand === 'usun') {
            const istniejacyDowod = dowodyDB.get(userId) || await pobierzLubOdzyskajDowod(interaction.guild, userId);
            if (!istniejacyDowod) return interaction.reply({ content: '❌ Nie posiadasz aktywnego dowodu.', ephemeral: true });

            const channel = await interaction.guild.channels.fetch(KANAL_WNIOSKOW).catch(() => null);
            if (!channel) return interaction.reply({ content: 'Błąd kanału wniosków.', ephemeral: true });

            const dane = istniejacyDowod.dane;
            const embed = new EmbedBuilder()
                .setTitle('Wniosek o usunięcie dowodu osobistego')
                .setColor(0xe67e22)
                .setDescription(`**Właściciel wniosku:** <@${userId}>\n\n### 🪪 Dowód przeznaczony do usunięcia:\n• **Imię i Nazwisko:** ${dane.imie}\n• **Data urodzenia:** ${dane.data_ur}\n• **Miejsce urodzenia:** ${dane.miejsce_ur}\n• **Płeć:** ${dane.plec}\n• **Nick Roblox:** ${dane.roblox}\n• **Nick Discord:** ${dane.discord}\n• **Praca:** ${dane.praca}`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dowod_akceptuj_usun_${userId}`).setLabel('Zatwierdź usunięcie').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`dowod_odrzuc_usun_${userId}`).setLabel('Odrzuć wniosek').setStyle(ButtonStyle.Danger)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });
            wnioskiDB.set(msg.id, { type: 'usun', userId, dane });
            return interaction.reply({ content: '✅ Wniosek o usunięcie dowodu został wysłany do administracji.', ephemeral: true });
        }
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (interaction.isModalSubmit()) {
                const userId = interaction.user.id;

                if (interaction.customId === 'modal_dowod_krok1' || interaction.customId === 'modal_dowod_edytuj_krok1') {
                    const isEdit = interaction.customId.includes('edytuj');
                    const imie = interaction.fields.getTextInputValue('imie');
                    const data_ur = interaction.fields.getTextInputValue('data_ur');
                    const miejsce_ur = interaction.fields.getTextInputValue('miejsce_ur');
                    const plec = interaction.fields.getTextInputValue('plec');
                    const praca = interaction.fields.getTextInputValue('praca');

                    tymczasoweDane.set(userId, { imie, data_ur, miejsce_ur, plec, praca, isEdit });
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`dowod_kontynuuj_${userId}`).setLabel('Przejdź do kroku 2 (Roblox/Discord)').setStyle(ButtonStyle.Primary)
                    );
                    return interaction.reply({ content: '✅ Zapisano pierwszy krok! Kliknij poniższy przycisk, aby uzupełnić drugą część formularza.', components: [row], ephemeral: true });
                }

                if (interaction.customId === 'modal_dowod_krok2' || interaction.customId === 'modal_dowod_edytuj_krok2') {
                    const isEdit = interaction.customId.includes('edytuj');
                    const dane1 = tymczasoweDane.get(userId);
                    if (!dane1) return interaction.reply({ content: '❌ Wygasły dane z pierwszego kroku. Zacznij od nowa.', ephemeral: true });

                    const roblox = interaction.fields.getTextInputValue('roblox');
                    const discordNick = interaction.fields.getTextInputValue('discord');
                    const channel = await interaction.guild.channels.fetch(KANAL_WNIOSKOW).catch(() => null);
                    if (!channel) return interaction.reply({ content: 'Błąd kanału wniosków.', ephemeral: true });

                    const pelneDane = { ...dane1, roblox, discord: discordNick };
                    const akcjaTyp = isEdit ? 'edytuj' : 'stworz';
                    const embed = new EmbedBuilder();

                    if (isEdit) {
                        const istniejacyDowod = dowodyDB.get(userId) || await pobierzLubOdzyskajDowod(interaction.guild, userId);
                        const starych = istniejacyDowod ? istniejacyDowod.dane : {};
                        embed.setTitle('Wniosek o edycję dowodu osobistego').setColor(0x3498db)
                            .setDescription(`**Właściciel:** <@${userId}>\n\n### 🔴 Dane przed zmianą:\n• **Imię i Nazwisko:** ${starych.imie || 'Brak'}\n• **Data urodzenia:** ${starych.data_ur || 'Brak'}\n• **Miejsce urodzenia:** ${starych.miejsce_ur || 'Brak'}\n• **Płeć:** ${starych.plec || 'Brak'}\n• **Nick Roblox:** ${starych.roblox || 'Brak'}\n• **Nick Discord:** ${starych.discord || 'Brak'}\n• **Praca:** ${starych.praca || 'Brak'}\n\n### 🟢 Dane po zmianie (Nowe):\n• **Imię i Nazwisko:** ${pelneDane.imie}\n• **Data urodzenia:** ${pelneDane.data_ur}\n• **Miejsce urodzenia:** ${pelneDane.miejsce_ur}\n• **Płeć:** ${pelneDane.plec}\n• **Nick Roblox:** ${pelneDane.roblox}\n• **Nick Discord:** ${pelneDane.discord}\n• **Praca:** ${pelneDane.praca}`);
                    } else {
                        embed.setTitle('Nowy wniosek o dowód osobisty').setColor(0x3498db)
                            .setDescription(`**Właściciel:** <@${userId}>\n\n**Imię i Nazwisko:** ${pelneDane.imie}\n**Data urodzenia:** ${pelneDane.data_ur}\n**Miejsce urodzenia:** ${pelneDane.miejsce_ur}\n**Płeć:** ${pelneDane.plec}\n**Nick Roblox:** ${pelneDane.roblox}\n**Nick Discord:** ${pelneDane.discord}\n**Aktualna praca:** ${pelneDane.praca}`);
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`dowod_akceptuj_${akcjaTyp}_${userId}`).setLabel('Akceptuj').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`dowod_odrzuc_${akcjaTyp}_${userId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
                    );

                    const msg = await channel.send({ embeds: [embed], components: [row] });
                    wnioskiDB.set(msg.id, { type: akcjaTyp, userId, dane: pelneDane });
                    tymczasoweDane.delete(userId);
                    return interaction.reply({ content: '🎉 Wniosek został w pełni uzupełniony i wysłany do administracji!', ephemeral: true });
                }
            }

            if (interaction.isButton() && interaction.customId.startsWith('dowod_')) {
                if (interaction.customId.startsWith('dowod_kontynuuj_')) {
                    const targetId = interaction.customId.split('_')[2];
                    if (interaction.user.id !== targetId) return interaction.reply({ content: '❌ To nie jest Twój formularz!', ephemeral: true });

                    const dane1 = tymczasoweDane.get(targetId);
                    const modal = new ModalBuilder().setCustomId(dane1?.isEdit ? 'modal_dowod_edytuj_krok2' : 'modal_dowod_krok2').setTitle('Dowód: Nicki (2/2)');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discord').setLabel('Nick Discord').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    return await interaction.showModal(modal);
                }

                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Nie masz uprawnień administratora do obsługi tego wniosku.', ephemeral: true });
                }

                await interaction.deferUpdate();
                const parts = interaction.customId.split('_');
                const [_, akcja, typ, targetUserId] = parts;
                const wniosek = wnioskiDB.get(interaction.message.id);
                const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                const disabledRow = new ActionRowBuilder().addComponents(
                    interaction.message.components[0].components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                );

                if (akcja === 'odrzuc') {
                    wnioskiDB.delete(interaction.message.id);
                    try { const user = await interaction.client.users.fetch(targetUserId); await user.send('Twoja prośba dotycząca dowodu osobistego została odrzucona przez administrację.'); } catch (e) {}
                    embed.setColor(0xe74c3c).setDescription(`❌ **Wniosek odrzucony przez <@${interaction.user.id}>**\n\n` + embed.data.description);
                    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
                    return interaction.followUp({ content: 'Odrzucono wniosek.', ephemeral: true });
                }

                if (akcja === 'akceptuj' && typ === 'stworz') {
                    const kanalDowodow = await interaction.guild.channels.fetch(KANAL_DOWODOW).catch(() => null);
                    if (!kanalDowodow) return interaction.followUp({ content: 'Nie znaleziono kanału docelowego dowodów.', ephemeral: true });
                    const dane = wniosek.dane;
                    const tekst = `🪪 DOWÓD OSOBISTY (<@${targetUserId}>) | OBYWATEL POLSKICH DRÓG \n\n**Dane Osobowe**\nImię i Nazwisko: ${dane.imie}\nData urodzenia: ${dane.data_ur}\nMiejsce urodzenia: ${dane.miejsce_ur}\nPłeć: (M/K) ${dane.plec}\nNick Roblox: ${dane.roblox}\nNick Discord: ${dane.discord}\nAktualna praca: ${dane.praca}`;
                    const wyslanaWiadomosc = await kanalDowodow.send(tekst);
                    dowodyDB.set(targetUserId, { wiadomoscId: wyslanaWiadomosc.id, linkWiadomosci: wyslanaWiadomosc.url, dane });
                    wnioskiDB.delete(interaction.message.id);
                    embed.setColor(0x2ecc71).setDescription(`✅ **Wniosek zaakceptowany przez <@${interaction.user.id}>**\n\n` + embed.data.description);
                    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
                    return interaction.followUp({ content: 'Zaakceptowano wniosek i utworzono dowód.', ephemeral: true });
                }

                if (akcja === 'akceptuj' && typ === 'edytuj') {
                    const istniejacyDowod = dowodyDB.get(targetUserId) || await pobierzLubOdzyskajDowod(interaction.guild, targetUserId);
                    if (!istniejacyDowod) return interaction.followUp({ content: 'Użytkownik nie ma aktywnego dowodu.', ephemeral: true });
                    const kanalDowodow = await interaction.guild.channels.fetch(KANAL_DOWODOW).catch(() => null);
                    const staryWpis = kanalDowodow ? await kanalDowodow.messages.fetch(istniejacyDowod.wiadomoscId).catch(() => null) : null;
                    const dane = wniosek.dane;
                    const nowyTekst = `🪪 DOWÓD OSOBISTY (<@${targetUserId}>) | OBYWATEL POLSKICH DRÓG \n\n**Dane Osobowe**\nImię i Nazwisko: ${dane.imie}\nData urodzenia: ${dane.data_ur}\nMiejsce urodzenia: ${dane.miejsce_ur}\nPłeć: (M/K) ${dane.plec}\nNick Roblox: ${dane.roblox}\nNick Discord: ${dane.discord}\nAktualna praca: ${dane.praca}`;
                    if (staryWpis) await staryWpis.edit(nowyTekst);
                    istniejacyDowod.dane = dane;
                    wnioskiDB.delete(interaction.message.id);
                    embed.setColor(0x2ecc71).setDescription(`✅ **Edycja zatwierdzona przez <@${interaction.user.id}>**\n\n` + embed.data.description);
                    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
                    return interaction.followUp({ content: 'Zaktualizowano dowód użytkownika.', ephemeral: true });
                }

                if (akcja === 'akceptuj' && typ === 'usun') {
                    const istniejacyDowod = dowodyDB.get(targetUserId) || await pobierzLubOdzyskajDowod(interaction.guild, targetUserId);
                    if (istniejacyDowod) {
                        const kanalDowodow = await interaction.guild.channels.fetch(KANAL_DOWODOW).catch(() => null);
                        const staryWpis = kanalDowodow ? await kanalDowodow.messages.fetch(istniejacyDowod.wiadomoscId).catch(() => null) : null;
                        if (staryWpis) await staryWpis.delete().catch(() => {});
                        dowodyDB.delete(targetUserId);
                    }
                    wnioskiDB.delete(interaction.message.id);
                    embed.setColor(0xf1c40f).setDescription(`⚠️ **Usunięcie dowodu zatwierdzone przez <@${interaction.user.id}>**\n\n` + embed.data.description);
                    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
                    return interaction.followUp({ content: 'Usunięto dowód użytkownika.', ephemeral: true });
                }
            }
        });
    }
};

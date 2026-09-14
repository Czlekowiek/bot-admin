const fs = require('fs');
const path = require('path');
const http = require('http');
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const { generateStaffEmbed } = require('./utils/sklad-administracji');
const { sendWelcomeMessage } = require('./utils/welcome');
const { sendLeaveMessage } = require('./utils/bye');

// =========================================================
// HTTP SERVER - RENDER
// =========================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end('Bot administracyjny dziala 24/7!\n');
});

server.listen(process.env.PORT || 3000);

// =========================================================
// CLIENT
// =========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// =========================================================
// BAZA DANYCH DOWODÓW (PLIK JSON)
// =========================================================

const dowodyFilePath = path.join(__dirname, 'dowody.json');

function loadDowodyDB() {
    if (fs.existsSync(dowodyFilePath)) {
        try {
            const data = fs.readFileSync(dowodyFilePath, 'utf8');
            const parsed = JSON.parse(data);
            return new Map(Object.entries(parsed));
        } catch (e) {
            console.error('Błąd podczas wczytywania pliku dowody.json:', e);
            return new Map();
        }
    }
    return new Map();
}

function saveDowodyDB(dbMap) {
    try {
        const obj = Object.fromEntries(dbMap);
        fs.writeFileSync(dowodyFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
        console.error('Błąd podczas zapisywania pliku dowody.json:', e);
    }
}

const dowodModule = {
    name: 'dowod',
    tymczasoweDane: new Map(),
    wnioskiDB: new Map(),
    dowodyDB: loadDowodyDB(), // Ładowanie trwałe przy starcie
    KANAL_WNIOSKOW: '1549106534561218722',
    KANAL_DOWODOW: '1548821312166699028'
};

client.commands = new Collection();
client.commands.set('dowod', dowodModule);

const commands = [];

// =========================================================
// CHANNELS & LOGS
// =========================================================

const CHANNEL_IDS = [
    '1548638166389366834',
    '1542122713676644352'
];

const LOG_CHANNEL_ID = '1548682257320120380';

async function sendLog(content) {
    try {
        const channel = await client.channels
            .fetch(LOG_CHANNEL_ID)
            .catch(() => null);

        if (channel) {
            await channel.send({ content });
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania logu:', error);
    }
}

// =========================================================
// WERSJE KOMEND
// =========================================================

const versionsFilePath = path.join(__dirname, 'command-versions.json');
let savedVersions = {};

if (fs.existsSync(versionsFilePath)) {
    try {
        savedVersions = JSON.parse(fs.readFileSync(versionsFilePath, 'utf8'));
    } catch (e) {
        savedVersions = {};
    }
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.existsSync(commandsPath) ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')) : [];

const currentVersions = {};
const modifiedCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const stats = fs.statSync(filePath);

    currentVersions[file] = stats.mtimeMs;

    if (savedVersions[file] !== undefined && savedVersions[file] !== stats.mtimeMs) {
        modifiedCommands.push(file.replace('.js', ''));
    }

    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

if (commandFiles.length > 0) {
    fs.writeFileSync(versionsFilePath, JSON.stringify(currentVersions, null, 2));
}

// =========================================================
// AKTUALIZACJA SKŁADU ADMINISTRACJI
// =========================================================

async function updateAdminMessage(guild) {
    try {
        const newEmbed = await generateStaffEmbed(guild);

        for (const channelId of CHANNEL_IDS) {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;

            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            const botMessage = messages ? messages.find(m => m.author.id === client.user.id) : null;

            if (botMessage) {
                await botMessage.edit({ content: null, embeds: [newEmbed] });
            } else {
                await channel.send({ embeds: [newEmbed] });
            }
        }
    } catch (error) {
        console.error('Błąd podczas aktualizacji wiadomości:', error);
    }
}

// =========================================================
// READY
// =========================================================

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);

    setTimeout(async () => {
        await sendLog(`Bot został uruchomiony. Zalogowano jako \`${client.user.tag}\`.`);

        if (modifiedCommands.length > 0) {
            const list = modifiedCommands.map(c => `\`/${c}\``).join(', ');
            await sendLog(`Wykryto zmianę kodu w komendach: ${list}`);
        }
    }, 2000);

    const guild = client.guilds.cache.first();

    if (guild) {
        const rest = new REST({ version: '10' }).setToken(client.token);

        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands }
            );
        } catch (error) {
            console.error(error);
            await sendLog(`❌ **Błąd podczas rejestrowania komend:** \`${error.message}\``);
        }

        await updateAdminMessage(guild);
    }
});

// =========================================================
// POWITANIA / POŻEGNANIA
// =========================================================

client.on('guildMemberAdd', async member => {
    try {
        await sendWelcomeMessage(member);
    } catch (error) {
        console.error('❌ Błąd podczas wysyłania powitania:', error);
    }
});

client.on('guildMemberRemove', async member => {
    try {
        await sendLeaveMessage(member);
    } catch (error) {
        console.error('❌ Błąd podczas wysyłania pożegnania:', error);
    }
});

// =========================================================
// KOMENDY SLASH (W TYM /dowod)
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'dowod') {
        const podkomenda = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (podkomenda === 'stworz') {
            if (dowodModule.dowodyDB.has(userId)) {
                return interaction.reply({ content: '❌ Masz już aktywny dowód osobisty! Użyj opcji edycji lub usuń obecny.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_dowod_krok1')
                .setTitle('Tworzenie dowodu: Dane (1/2)');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Imię i Nazwisko').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Data urodzenia (np. 01.01.2000)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Miejsce urodzenia').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Płeć (M / K)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('praca').setLabel('Aktualna praca').setStyle(TextInputStyle.Short).setRequired(true))
            );

            return await interaction.showModal(modal);
        }

        if (podkomenda === 'edytuj') {
            if (!dowodModule.dowodyDB.has(userId)) {
                return interaction.reply({ content: '❌ Nie masz jeszcze swojego dowodu osobistego, więc nie masz czego edytować.', ephemeral: true });
            }

            const istniejacy = dowodModule.dowodyDB.get(userId).dane;

            const modal = new ModalBuilder()
                .setCustomId('modal_dowod_edytuj_krok1')
                .setTitle('Edycja dowodu: Dane (1/2)');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imie').setLabel('Imię i Nazwisko').setValue(istniejacy.imie || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_ur').setLabel('Data urodzenia').setValue(istniejacy.data_ur || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('miejsce_ur').setLabel('Miejsce urodzenia').setValue(istniejacy.miejsce_ur || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plec').setLabel('Płeć (M / K)').setValue(istniejacy.plec || '').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('praca').setLabel('Aktualna praca').setValue(istniejacy.praca || '').setStyle(TextInputStyle.Short).setRequired(true))
            );

            return await interaction.showModal(modal);
        }

        if (podkomenda === 'usun') {
            const istniejacyDowod = dowodModule.dowodyDB.get(userId);
            if (!istniejacyDowod) {
                return interaction.reply({ content: '❌ Nie posiadasz aktywnego dowodu.', ephemeral: true });
            }

            const channel = await interaction.guild.channels.fetch(dowodModule.KANAL_WNIOSKOW).catch(() => null);
            if (!channel) return interaction.reply({ content: 'Błąd kanału wniosków.', ephemeral: true });

            const dane = istniejacyDowod.dane;
            const embed = new EmbedBuilder()
                .setTitle('Wniosek o usunięcie dowodu osobistego')
                .setColor(0xe67e22)
                .setDescription(`**Właściciel wniosku:** <@${userId}>\n\n` +
                    `### 🪪 Dowód przeznaczony do usunięcia:\n` +
                    `• **Imię i Nazwisko:** ${dane.imie}\n` +
                    `• **Data urodzenia:** ${dane.data_ur}\n` +
                    `• **Miejsce urodzenia:** ${dane.miejsce_ur}\n` +
                    `• **Płeć:** ${dane.plec}\n` +
                    `• **Nick Roblox:** ${dane.roblox}\n` +
                    `• **Nick Discord:** ${dane.discord}\n` +
                    `• **Praca:** ${dane.praca}`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dowod_akceptuj_usun_${userId}`).setLabel('Zatwierdź usunięcie').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`dowod_odrzuc_usun_${userId}`).setLabel('Odrzuć wniosek').setStyle(ButtonStyle.Danger)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });
            dowodModule.wnioskiDB.set(msg.id, { type: 'usun', userId, dane });

            return interaction.reply({ content: '✅ Wniosek o usunięcie dowodu został wysłany do administracji.', ephemeral: true });
        }
    }

    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.execute !== 'function') return;

    await sendLog(`Użytkownik ${interaction.user.tag} użył komendy \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await sendLog(`❌ **Błąd podczas wykonywania komendy** \`/${interaction.commandName}\` przez ${interaction.user.tag}: \`${error.message}\``);

        const replyOptions = {
            content: 'Wystąpił błąd podczas wykonywania tej komendy!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    }
});

// =========================================================
// OBSŁUGA MODALI DOWODÓW
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    const dowodModule = client.commands.get('dowod');
    if (!dowodModule) return;

    const userId = interaction.user.id;

    if (interaction.customId === 'modal_dowod_krok1' || interaction.customId === 'modal_dowod_edytuj_krok1') {
        const isEdit = interaction.customId.includes('edytuj');

        const imie = interaction.fields.getTextInputValue('imie');
        const data_ur = interaction.fields.getTextInputValue('data_ur');
        const miejsce_ur = interaction.fields.getTextInputValue('miejsce_ur');
        const plec = interaction.fields.getTextInputValue('plec');
        const praca = interaction.fields.getTextInputValue('praca');

        dowodModule.tymczasoweDane.set(userId, { imie, data_ur, miejsce_ur, plec, praca, isEdit });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`dowod_kontynuuj_${userId}`).setLabel('Przejdź do kroku 2 (Roblox/Discord)').setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({ content: '✅ Zapisano pierwszy krok! Kliknij poniższy przycisk, aby uzupełnić drugą część formularza.', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'modal_dowod_krok2' || interaction.customId === 'modal_dowod_edytuj_krok2') {
        const isEdit = interaction.customId.includes('edytuj');
        const dane1 = dowodModule.tymczasoweDane.get(userId);

        if (!dane1) {
            return interaction.reply({ content: '❌ Wygasły dane z pierwszego kroku. Zacznij od nowa.', ephemeral: true });
        }

        const roblox = interaction.fields.getTextInputValue('roblox');
        const discordNick = interaction.fields.getTextInputValue('discord');

        const channel = await interaction.guild.channels.fetch(dowodModule.KANAL_WNIOSKOW).catch(() => null);
        if (!channel) return interaction.reply({ content: 'Błąd kanału wniosków.', ephemeral: true });

        const pelneDane = { ...dane1, roblox, discord: discordNick };
        const akcjaTyp = isEdit ? 'edytuj' : 'stworz';
        const embed = new EmbedBuilder();

        if (isEdit) {
            const istniejacyDowod = dowodModule.dowodyDB.get(userId);
            const starych = istniejacyDowod ? istniejacyDowod.dane : {};

            embed.setTitle('Wniosek o edycję dowodu osobistego')
                .setColor(0x3498db)
                .setDescription(`**Właściciel:** <@${userId}>\n\n` +
                    `### 🔴 Dane przed zmianą:\n` +
                    `• **Imię i Nazwisko:** ${starych.imie || 'Brak'}\n` +
                    `• **Data urodzenia:** ${starych.data_ur || 'Brak'}\n` +
                    `• **Miejsce urodzenia:** ${starych.miejsce_ur || 'Brak'}\n` +
                    `• **Płeć:** ${starych.plec || 'Brak'}\n` +
                    `• **Nick Roblox:** ${starych.roblox || 'Brak'}\n` +
                    `• **Nick Discord:** ${starych.discord || 'Brak'}\n` +
                    `• **Praca:** ${starych.praca || 'Brak'}\n\n` +
                    `### 🟢 Dane po zmianie (Nowe):\n` +
                    `• **Imię i Nazwisko:** ${pelneDane.imie}\n` +
                    `• **Data urodzenia:** ${pelneDane.data_ur}\n` +
                    `• **Miejsce urodzenia:** ${pelneDane.miejsce_ur}\n` +
                    `• **Płeć:** ${pelneDane.plec}\n` +
                    `• **Nick Roblox:** ${pelneDane.roblox}\n` +
                    `• **Nick Discord:** ${pelneDane.discord}\n` +
                    `• **Praca:** ${pelneDane.praca}`);
        } else {
            embed.setTitle('Nowy wniosek o dowód osobisty')
                .setColor(0x3498db)
                .setDescription(`**Właściciel:** <@${userId}>\n\n` +
                    `**Imię i Nazwisko:** ${pelneDane.imie}\n` +
                    `**Data urodzenia:** ${pelneDane.data_ur}\n` +
                    `**Miejsce urodzenia:** ${pelneDane.miejsce_ur}\n` +
                    `**Płeć:** ${pelneDane.plec}\n` +
                    `**Nick Roblox:** ${pelneDane.roblox}\n` +
                    `**Nick Discord:** ${pelneDane.discord}\n` +
                    `**Aktualna praca:** ${pelneDane.praca}`);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`dowod_akceptuj_${akcjaTyp}_${userId}`).setLabel('Akceptuj').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`dowod_odrzuc_${akcjaTyp}_${userId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        dowodModule.wnioskiDB.set(msg.id, { type: akcjaTyp, userId, dane: pelneDane });
        dowodModule.tymczasoweDane.delete(userId);

        return interaction.reply({ content: '🎉 Wniosek został w pełni uzupełniony i wysłany do administracji!', ephemeral: true });
    }
});

// =========================================================
// OBSŁUGA PRZYCISKÓW DOWODÓW (KONTINUACJA I ADMIN)
// =========================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('dowod_')) return;

    const dowodModule = client.commands.get('dowod');
    if (!dowodModule) return;

    if (interaction.customId.startsWith('dowod_kontynuuj_')) {
        const targetId = interaction.customId.split('_')[2];
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: '❌ To nie jest Twój formularz!', ephemeral: true });
        }

        const dane1 = dowodModule.tymczasoweDane.get(targetId);
        const isEdit = dane1 ? dane1.isEdit : false;

        const modal = new ModalBuilder()
            .setCustomId(isEdit ? 'modal_dowod_edytuj_krok2' : 'modal_dowod_krok2')
            .setTitle('Dowód: Nicki (2/2)');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discord').setLabel('Nick Discord').setStyle(TextInputStyle.Short).setRequired(true))
        );

        return await interaction.showModal(modal);
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Nie masz uprawnień administratora do obsługi tego wniosku.', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const akcja = parts[1]; // akceptuj lub odrzuc
    const typ = parts[2];   // stworz, edytuj lub usun
    const targetUserId = parts[3];

    const wniosek = dowodModule.wnioskiDB.get(interaction.message.id);
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);

    const disabledRow = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map(btn => 
            ButtonBuilder.from(btn).setDisabled(true)
        )
    );

    if (akcja === 'odrzuc') {
        dowodModule.wnioskiDB.delete(interaction.message.id);

        try {
            const user = await client.users.fetch(targetUserId);
            await user.send('Twoja prośba dotycząca dowodu osobistego została odrzucona przez administrację.');
        } catch (e) {}

        embed.setColor(0xe74c3c); // Czerwony
        embed.setDescription(`❌ **Wniosek odrzucony przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.reply({ content: 'Odrzucono wniosek.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'stworz') {
        const kanałDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
        if (!kanałDowodow) return interaction.reply({ content: 'Nie znaleziono kanału docelowego dowodów.', ephemeral: true });

        const dane = wniosek.dane;
        const tekstDowodu = `🪪 DOWÓD OSOBISTY (<@${targetUserId}>) | OBYWATEL POLSKICH DRÓG \n\n` +
            `**Dane Osobowe**\n` +
            `Imię i Nazwisko: ${dane.imie}\n` +
            `Data urodzenia: ${dane.data_ur}\n` +
            `Miejsce urodzenia: ${dane.miejsce_ur}\n` +
            `Płeć: (M/K) ${dane.plec}\n` +
            `Nick Roblox: ${dane.roblox}\n` +
            `Nick Discord: ${dane.discord}\n` +
            `Aktualna praca: ${dane.praca}`;

        const wyslanaWiadomosc = await kanałDowodow.send(tekstDowodu);

        dowodModule.dowodyDB.set(targetUserId, {
            wiadomoscId: wyslanaWiadomosc.id,
            linkWiadomosci: wyslanaWiadomosc.url,
            dane
        });
        saveDowodyDB(dowodModule.dowodyDB); // Zapis do pliku JSON

        dowodModule.wnioskiDB.delete(interaction.message.id);
        
        embed.setColor(0x2ecc71); // Zielony
        embed.setDescription(`✅ **Wniosek zaakceptowany przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.reply({ content: 'Zaakceptowano wniosek i utworzono dowód.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'edytuj') {
        const istniejacyDowod = dowodModule.dowodyDB.get(targetUserId);
        if (!istniejacyDowod) return interaction.reply({ content: 'Użytkownik nie ma aktywnego dowodu.', ephemeral: true });

        const kanałDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
        const staryWpis = kanałDowodow ? await kanałDowodow.messages.fetch(istniejacyDowod.wiadomoscId).catch(() => null) : null;

        const dane = wniosek.dane;
        const nowyTekst = `🪪 DOWÓD OSOBISTY (<@${targetUserId}>) | OBYWATEL POLSKICH DRÓG \n\n` +
            `**Dane Osobowe**\n` +
            `Imię i Nazwisko: ${dane.imie}\n` +
            `Data urodzenia: ${dane.data_ur}\n` +
            `Miejsce urodzenia: ${dane.miejsce_ur}\n` +
            `Płeć: (M/K) ${dane.plec}\n` +
            `Nick Roblox: ${dane.roblox}\n` +
            `Nick Discord: ${dane.discord}\n` +
            `Aktualna praca: ${dane.praca}`;

        if (staryWpis) {
            await staryWpis.edit(nowyTekst);
        }

        istniejacyDowod.dane = dane;
        saveDowodyDB(dowodModule.dowodyDB); // Zapis do pliku JSON

        dowodModule.wnioskiDB.delete(interaction.message.id);

        embed.setColor(0x2ecc71); // Zielony
        embed.setDescription(`✅ **Edycja zatwierdzona przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.reply({ content: 'Zaktualizowano dowód użytkownika.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'usun') {
        const istniejacyDowod = dowodModule.dowodyDB.get(targetUserId);
        if (istniejacyDowod) {
            const kanałDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
            const staryWpis = kanałDowodow ? await kanałDowodow.messages.fetch(istniejacyDowod.wiadomoscId).catch(() => null) : null;
            if (staryWpis) await staryWpis.delete().catch(() => {});
            dowodModule.dowodyDB.delete(targetUserId);
            saveDowodyDB(dowodModule.dowodyDB); // Zapis do pliku JSON
        }

        dowodModule.wnioskiDB.delete(interaction.message.id);

        embed.setColor(0xf1c40f); // Żółty / Bursztynowy
        embed.setDescription(`⚠️ **Usunięcie dowodu zatwierdzone przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.reply({ content: 'Usunięto dowód użytkownika.', ephemeral: true });
    }
});

// =========================================================
// HISTORIA REAKCJI I TABLICA AKTYWNOŚCI
// =========================================================

const reactionHistory = new Map();

async function getOrCreateUsersList(reaction) {
    const msgId = reaction.message.id;
    if (!reactionHistory.has(msgId)) {
        const usersMap = await reaction.users.fetch({ limit: 100 });
        const usersList = [];
        for (const [userId, user] of usersMap) {
            if (!user.bot) {
                usersList.push(userId);
            }
        }
        reactionHistory.set(msgId, usersList);
    }
    return reactionHistory.get(msgId);
}

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }
    if (reaction.emoji.id !== '1543969158646206475') return;

    const usersList = await getOrCreateUsersList(reaction);
    if (!usersList.includes(user.id)) {
        usersList.push(user.id);
    }
    await updateActivityBoard(reaction.message, usersList);
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }
    if (reaction.emoji.id !== '1543969158646206475') return;

    const usersList = await getOrCreateUsersList(reaction);
    const index = usersList.indexOf(user.id);
    if (index > -1) {
        usersList.splice(index, 1);
    }
    await updateActivityBoard(reaction.message, usersList);
});

async function updateActivityBoard(message, usersList) {
    if (!message.embeds.length) return;

    const embed = message.embeds[0];
    const description = embed.description;
    const opisMatch = description.split(/### <:arrow:1543977081233342494> Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : null;

    const top1 = usersList[0] ? `<@${usersList[0]}>` : 'Brak';
    const top2 = usersList[1] ? `<@${usersList[1]}>` : 'Brak';
    const top3 = usersList[2] ? `<@${usersList[2]}>` : 'Brak';

    let newDescription =
        `# <a:checkmark:1543969158646206475> Aktywność check\n` +
        `## <a:top1:1548673656761352304> ${top1}\n` +
        `## <a:top2:1548673747983011891> ${top2}\n` +
        `## <a:top3:1548673801104138322> ${top3}\n\n` +
        `## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

    if (activityDescription) {
        newDescription += `\n\n### <:arrow:1543977081233342494> Opis: ${activityDescription}`;
    }

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);

    await message.edit({ embeds: [updatedEmbed] });
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await updateAdminMessage(newMember.guild);
});

// =========================================================
// ZAMYKANIE PROCESU
// =========================================================

process.on('SIGINT', () => { process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });

// =========================================================
// LOGOWANIE BOTA
// =========================================================

client.login(
    'MTU0ODYzNjU3NTEyMDc1MjY4MQ.GMbXfK.dEs0hkRP1k0oDVIZKz1kck0nnMbYJmAiaw64cU'
);

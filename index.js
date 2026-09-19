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
// BAZY DANYCH / PAMIĘĆ (DOWODY I WERYFIKACJA)
// =========================================================

const captchaStorage = new Map();
const ROLA_NIEZWERYFIKOWANY = '1550876638013685901';
const ROLA_ZWERYFIKOWANY = '1542126972669403178';
const KANAL_WERYFIKACJI = '1544013529353294004';

function generateRandomDigits() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

const dowodModule = {
    name: 'dowod',
    tymczasoweDane: new Map(),
    wnioskiDB: new Map(),
    dowodyDB: new Map(),
    KANAL_WNIOSKOW: '1549106534561218722',
    KANAL_DOWODOW: '1548821312166699028'
};

async function pobierzLubOdzyskajDowod(interaction, userId) {
    if (dowodModule.dowodyDB.has(userId)) {
        return dowodModule.dowodyDB.get(userId);
    }

    const kanalDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
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
        dowodModule.dowodyDB.set(userId, dowodObj);
        return dowodObj;
    }

    return null;
}

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
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
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
// POWITANIA / POŻEGNANIA / WERYFIKACJA AUTOMATYCZNA
// =========================================================

client.on('guildMemberAdd', async member => {
    try {
        await member.roles.add(ROLA_NIEZWERYFIKOWANY).catch(() => {});
        await sendWelcomeMessage(member);
    } catch (error) {
        console.error('❌ Błąd podczas powitania / nadawania roli:', error);
    }
});

client.on('guildMemberRemove', async member => {
    try {
        await sendLeaveMessage(member);
    } catch (error) {
        console.error('❌ Błąd podczas wysyłania pożegnania:', error);
    }
});

client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    if (channel.id === KANAL_WERYFIKACJI) return;
    if (channel.isThread && channel.isThread()) return;

    try {
        await channel.permissionOverwrites.edit(ROLA_NIEZWERYFIKOWANY, {
            ViewChannel: false
        });
    } catch (error) {}
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
            const istniejacy = await pobierzLubOdzyskajDowod(interaction, userId);
            if (istniejacy) {
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
            let istniejacyDowod = dowodModule.dowodyDB.get(userId);

            if (!istniejacyDowod) {
                istniejacyDowod = await pobierzLubOdzyskajDowod(interaction, userId);
            }

            if (!istniejacyDowod) {
                return interaction.reply({ content: '❌ Nie masz jeszcze swojego dowodu osobistego, więc nie masz czego edytować.', ephemeral: true });
            }

            const istniejacy = istniejacyDowod.dane;

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
            let istniejacyDowod = dowodModule.dowodyDB.get(userId);

            if (!istniejacyDowod) {
                istniejacyDowod = await pobierzLubOdzyskajDowod(interaction, userId);
            }

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
// OBSŁUGA INTERAKCJI (WERYFIKACJA + MODALE DOWODÓW)
// =========================================================

client.on('interactionCreate', async interaction => {
    // 1. Obsługa przycisku Weryfikacji
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

    // 2. Obsługa przesłania modala Weryfikacji
    if (interaction.isModalSubmit() && interaction.customId === 'verification_modal_submit') {
        await interaction.deferReply({ ephemeral: true });
        
        const userInput = interaction.fields.getTextInputValue('verification_code_input').trim();
        const expectedCode = captchaStorage.get(interaction.user.id);

        if (!expectedCode || userInput !== expectedCode) {
            return interaction.editReply({ content: '❌ Błędny kod! Kliknij przycisk "Zweryfikuj" ponownie.' });
        }

        captchaStorage.delete(interaction.user.id);

        const member = interaction.member;
        try {
            if (member.roles.cache.has(ROLA_NIEZWERYFIKOWANY)) {
                await member.roles.remove(ROLA_NIEZWERYFIKOWANY);
            }
            await member.roles.add(ROLA_ZWERYFIKOWANY);

            return interaction.editReply({ content: '✅ Pomyślnie zweryfikowano! Witaj na serwerze.' });
        } catch (error) {
            console.error('Błąd podczas nadawania ról weryfikacji:', error);
            return interaction.editReply({ content: '❌ Wystąpił błąd podczas nadawania ról. Powiadom administrację.' });
        }
    }

    // 3. Obsługa Modali Dowodów
    if (interaction.isModalSubmit()) {
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
                const istniejacyDowod = await pobierzLubOdzyskajDowod(interaction, userId);
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
    }
});

// =========================================================
// OBSŁUGA PRZYCISKÓW DOWODÓW
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

    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const akcja = parts[1];
    const typ = parts[2];
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

        embed.setColor(0xe74c3c);
        embed.setDescription(`❌ **Wniosek odrzucony przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: 'Odrzucono wniosek.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'stworz') {
        const kanałDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
        if (!kanałDowodow) return interaction.followUp({ content: 'Nie znaleziono kanału docelowego dowodów.', ephemeral: true });

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

        dowodModule.wnioskiDB.delete(interaction.message.id);
        
        embed.setColor(0x2ecc71);
        embed.setDescription(`✅ **Wniosek zaakceptowany przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: 'Zaakceptowano wniosek i utworzono dowód.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'edytuj') {
        const istniejacyDowod = await pobierzLubOdzyskajDowod(interaction, targetUserId);
        if (!istniejacyDowod) return interaction.followUp({ content: 'Użytkownik nie ma aktywnego dowodu.', ephemeral: true });

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
        dowodModule.wnioskiDB.delete(interaction.message.id);

        embed.setColor(0x2ecc71);
        embed.setDescription(`✅ **Edycja zatwierdzona przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: 'Zaktualizowano dowód użytkownika.', ephemeral: true });
    }

    if (akcja === 'akceptuj' && typ === 'usun') {
        const istniejacyDowod = await pobierzLubOdzyskajDowod(interaction, targetUserId);
        if (istniejacyDowod) {
            const kanałDowodow = await interaction.guild.channels.fetch(dowodModule.KANAL_DOWODOW).catch(() => null);
            const staryWpis = kanałDowodow ? await kanałDowodow.messages.fetch(istniejacyDowod.wiadomoscId).catch(() => null) : null;
            if (staryWpis) await staryWpis.delete().catch(() => {});
            dowodModule.dowodyDB.delete(targetUserId);
        }

        dowodModule.wnioskiDB.delete(interaction.message.id);

        embed.setColor(0xf1c40f);
        embed.setDescription(`⚠️ **Usunięcie dowodu zatwierdzone przez <@${interaction.user.id}>**\n\n` + embed.data.description);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: 'Usunięto dowód użytkownika.', ephemeral: true });
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

const { EmbedBuilder } = require('discord.js');
const LOG_CHANNEL_ID = '1548682257320120380';

async function sendLog(client, options) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(options.color || 0x3498db)
            .setTitle(options.title || 'Log systemowy')
            .setDescription(options.description || 'Brak treści logu.')
            .setTimestamp();

        if (options.executor) {
            embed.setFooter({ 
                text: `Wykonawca: ${options.executor.tag} (${options.executor.id})`, 
                iconURL: options.executor.displayAvatarURL() 
            });
        } else {
            embed.setFooter({ text: 'System / Automatyzacja bota' });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Błąd podczas wysyłania logu w embedzie:', error);
    }
}

function setupGlobalLogs(client) {
    // 1. Uruchomienie bota (Zielony)
    client.once('ready', async () => {
        await sendLog(client, {
            title: 'Bot Uruchomiony',
            description: `Bot został pomyślnie uruchomiony i jest gotowy do działania.\n\n• **Tag:** \`${client.user.tag}\`\n• **ID:** \`${client.user.id}\``,
            color: 0x2ecc71
        });
    });

    // 2. Użycie komend slash (Niebieski)
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        await sendLog(client, {
            title: 'Użyto Komendy Slash',
            description: `Użytkownik użył komendy na serwerie.\n\n• **Komenda:** \`/${interaction.commandName}\`\n• **Kanał:** <#${interaction.channelId}>`,
            color: 0x3498db,
            executor: interaction.user
        });
    });

    // 3. Wejście użytkownika (Zielony)
    client.on('guildMemberAdd', async member => {
        await sendLog(client, {
            title: 'Nowy Użytkownik Dołączył',
            description: `Użytkownik wszedł na serwer.\n\n• **Użytkownik:** <@${member.id}> (\`${member.user.tag}\`)\n• **ID:** \`${member.id}\``,
            color: 0x2ecc71,
            executor: member.user
        });
    });

    // 4. Wyjście użytkownika (Czerwony)
    client.on('guildMemberRemove', async member => {
        await sendLog(client, {
            title: 'Użytkownik Opuścił Serwer',
            description: `Użytkownik wyszedł lub został wyrzucony.\n\n• **Użytkownik:** <@${member.id}> (\`${member.user.tag}\`)\n• **ID:** \`${member.id}\``,
            color: 0xe74c3c,
            executor: member.user
        });
    });

    // 5. Edycja wiadomości bota (Żółty/Pomarańczowy) - Pokazuje przed i po
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author?.id !== client.user.id) return;
        if (oldMessage.content === newMessage.content && oldMessage.embeds.length === newMessage.embeds.length) return;

        const oldText = oldMessage.content || (oldMessage.embeds.length > 0 ? '[Embed]' : 'Brak treści');
        const newText = newMessage.content || (newMessage.embeds.length > 0 ? '[Embed]' : 'Brak treści');

        await sendLog(client, {
            title: 'Edycja Wiadomości Bota',
            description: `Bot zaktualizował swoją wiadomość na kanale <#${newMessage.channelId}>.\n\n**Przed zmianą:**\n\`\`\`text\n${oldText.slice(0, 500)}\n\`\`\`\n**Po zmianie:**\n\`\`\`text\n${newText.slice(0, 500)}\n\`\`\``,
            color: 0xf1c40f
        });
    });

    // 6. Usunięcie wiadomości bota (Czerwony) - Pokazuje treść usuniętej wiadomości
    client.on('messageDelete', async message => {
        if (!message.guild || message.author?.id !== client.user.id) return;
        const content = message.content || (message.embeds.length > 0 ? '[Wiadomość zawierała embed]' : 'Brak treści tekstowej');

        await sendLog(client, {
            title: 'Usunięto Wiadomość Bota',
            description: `Wiadomość wysłana przez bota została skasowana na kanale <#${message.channelId}>.\n\n**Treść usuniętej wiadomości:**\n\`\`\`text\n${content.slice(0, 900)}\n\`\`\``,
            color: 0xe74c3c
        });
    });

    // 7. Dodanie reakcji (Fioletowy)
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
        
        await sendLog(client, {
            title: 'Dodano Reakcję',
            description: `Użytkownik zareagował na wiadomość.\n\n• **Emotka:** \`${reaction.emoji.name}\`\n• **Kanał:** <#${reaction.message.channelId}>`,
            color: 0x9b59b6,
            executor: user
        });
    });

    // 8. Usunięcie reakcji (Fioletowy)
    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }

        await sendLog(client, {
            title: 'Usunięto Reakcję',
            description: `Użytkownik cofnął reakcję.\n\n• **Emotka:** \`${reaction.emoji.name}\`\n• **Kanał:** <#${reaction.message.channelId}>`,
            color: 0x9b59b6,
            executor: user
        });
    });
}

module.exports = { sendLog, setupGlobalLogs };

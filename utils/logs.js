const LOG_CHANNEL_ID = '1548682257320120380';

async function sendLog(client, content) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) {
            await channel.send({ content });
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania logu:', error);
    }
}

function setupGlobalLogs(client) {
    // 1. Uruchomienie bota
    client.once('ready', async () => {
        await sendLog(client, `🟢 **Bot został uruchomiony.** Zalogowano jako \`${client.user.tag}\`.`);
    });

    // 2. Użycie komend slash
    client.on('interactionCreate', async interaction => {
        if (interaction.isChatInputCommand()) {
            await sendLog(client, `⌨️ Użytkownik **${interaction.user.tag}** użył komendy \`/${interaction.commandName}\` na kanale <#${interaction.channelId}>.`);
        }
    });

    // 3. Wejście użytkownika na serwer
    client.on('guildMemberAdd', async member => {
        await sendLog(client, `📥 Użytkownik **${member.user.tag}** (\`${member.id}\`) dołączył na serwer.`);
    });

    // 4. Wyjście użytkownika z serwera
    client.on('guildMemberRemove', async member => {
        await sendLog(client, `📤 Użytkownik **${member.user.tag}** (\`${member.id}\`) opuścił serwer.`);
    });

    // 5. Edycja wiadomości bota
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author?.id !== client.user.id) return;
        if (oldMessage.content !== newMessage.content || oldMessage.embeds.length !== newMessage.embeds.length) {
            await sendLog(client, `✏️ Wiadomość wysłana przez bota została **zaktualizowana** na kanale <#${newMessage.channelId}>.`);
        }
    });

    // 6. Usunięcie wiadomości bota
    client.on('messageDelete', async message => {
        if (!message.guild || message.author?.id !== client.user.id) return;
        await sendLog(client, `🗑️ Wiadomość bota została **usunięta** na kanale <#${message.channelId}>.`);
    });

    // 7. Dodanie reakcji (np. do tablicy aktywności)
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        await sendLog(client, `⭐ Użytkownik **${user.tag}** dodał reakcję \`${reaction.emoji.name}\` na kanale <#${reaction.message.channelId}>.`);
    });

    // 8. Usunięcie reakcji
    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        await sendLog(client, `ToRemove ⭐ Użytkownik **${user.tag}** usunął reakcję \`${reaction.emoji.name}\` na kanale <#${reaction.message.channelId}>.`);
    });
}

module.exports = { sendLog, setupGlobalLogs };

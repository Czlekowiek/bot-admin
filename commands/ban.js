const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} = require('discord.js');

const TARGET_CHANNEL_ID = '1556307155693600768';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wystaw-bana')
        .setDescription('Wystawia informację o banie na wyznaczonym kanale.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Tworzenie modalu z polami
        const modal = new ModalBuilder()
            .setCustomId('modal_wystaw_bana')
            .setTitle('Wystaw bana');

        const userIdInput = new TextInputBuilder()
            .setCustomId('ban_user_id')
            .setLabel('ID Użytkownika')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Wpisz ID gracza, np. 123456789012345678')
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('ban_reason')
            .setLabel('Powód')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Wpisz powód bana')
            .setRequired(true);

        const proofsInput = new TextInputBuilder()
            .setCustomId('ban_proofs')
            .setLabel('Dowód / Dowody')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Wklej link do dowodu (lub kilka, oddzielając spacją/enterem)')
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('ban_duration')
            .setLabel('Czas')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Np. Permanentny, 7 dni, 24 godziny')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userIdInput),
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(proofsInput),
            new ActionRowBuilder().addComponents(durationInput)
        );

        await interaction.showModal(modal);
    },

    setupEvents(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== 'modal_wystaw_bana') return;

            await interaction.deferReply({ ephemeral: true });

            const targetUserId = interaction.fields.getTextInputValue('ban_user_id').trim();
            const reason = interaction.fields.getTextInputValue('ban_reason').trim();
            const proofsRaw = interaction.fields.getTextInputValue('ban_proofs').trim();
            const duration = interaction.fields.getTextInputValue('ban_duration').trim();
            const banner = interaction.user;

            let userTag = `<@${targetUserId}> (${targetUserId})`;
            try {
                const fetchedUser = await client.users.fetch(targetUserId);
                if (fetchedUser) {
                    userTag = `${fetchedUser.tag} (<@${fetchedUser.id}>)`;
                }
            } catch (e) {
                // Jeśli ID jest nieprawidłowe lub użytkownik nie istnieje, zostaje sformatowane jako ID
            }

            const now = new Date();
            const formattedDate = now.toLocaleString('pl-PL', {
                timeZone: 'Europe/Warsaw',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const mainEmbed = new EmbedBuilder()
                .setColor(0xbf0704)
                .setTitle('<:banhammer:1556309107672092683> Ban Discord')
                .setDescription(
                    `<:arrow:1543977081233342494> **Nazwa:** ${userTag}\n` +
                    `<:arrow:1543977081233342494> **Banujący:** <@${banner.id}>\n` +
                    `<:arrow:1543977081233342494> **Powód:** ${reason}\n` +
                    `<:arrow:1543977081233342494> **Długość:** ${duration}\n` +
                    `<:arrow:1543977081233342494> **Data:** ${formattedDate}`
                );

            const embedsToSend = [mainEmbed];

            const links = proofsRaw.split(/[\s,]+/).filter(link => link.startsWith('http://') || link.startsWith('https://'));

            for (const link of links) {
                const proofEmbed = new EmbedBuilder()
                    .setColor(0xbf0704)
                    .setImage(link);
                embedsToSend.push(proofEmbed);
            }

            const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
            if (!channel) {
                return interaction.editReply({ 
                    content: '# <a:redtick:1543991522192527450> Błąd\n<:arrow:1543977081233342494> Nie znaleziono kanału docelowego o podanym ID!' 
                });
            }

            await channel.send({ embeds: embedsToSend });
            return interaction.editReply({ 
                content: '# <a:checkmark:1543969158646206475> Sukces\n<:arrow:1543977081233342494> Pomyślnie wystawiono informację o banie!' 
            });
        });
    }
};
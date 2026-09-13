client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.id !== '1543969158646206475') return;

    await updateActivityBoard(reaction.message);
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.id !== '1543969158646206475') return;

    await updateActivityBoard(reaction.message);
});

async function updateActivityBoard(message) {
    if (!message.embeds.length) return;
    const embed = message.embeds[0];
    const description = embed.description;

    const opisMatch = description.split(/Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : '';

    const reaction = message.reactions.cache.get('1543969158646206475');
    if (!reaction) return;

    const users = await reaction.users.fetch();
    const humanUsers = Array.from(users.values()).filter(u => !u.bot);

    const top1 = humanUsers[0] ? `<@${humanUsers[0].id}>` : 'Brak';
    const top2 = humanUsers[1] ? `<@${humanUsers[1].id}>` : 'Brak';
    const top3 = humanUsers[2] ? `<@${humanUsers[2].id}>` : 'Brak';

    const newDescription = `## <a:top1:1548673656761352304> 1. ${top1}\n## <a:top2:1548673747983011891> 2. ${top2}\n## <a:top3:1548673801104138322> 3. ${top3}\n\n<a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.\n\nOpis: ${activityDescription}`;

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
    await message.edit({ embeds: [updatedEmbed] });
}

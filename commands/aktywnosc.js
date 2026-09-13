async function updateActivityBoard(message) {
    if (!message.embeds.length) return;
    const embed = message.embeds[0];
    const description = embed.description;

    const opisMatch = description.split(/Opis: /);
    const activityDescription = opisMatch[1] ? opisMatch[1] : null;

    const reaction = message.reactions.cache.get('1543969158646206475');
    if (!reaction) return;

    // Pobieramy użytkowników z API
    const users = await reaction.users.fetch({ limit: 100 });
    
    // Tworzymy tablicę użytkowników (pomijając boty)
    // Zamiast polegać ślepo na kolejności z cache, pobieramy ich w kolejności iteracji API
    const humanUsers = [];
    for (const [userId, user] of users) {
        if (!user.bot) {
            humanUsers.push(user);
        }
    }

    const top1 = humanUsers[0] ? `<@${humanUsers[0].id}>` : 'Brak';
    const top2 = humanUsers[1] ? `<@${humanUsers[1].id}>` : 'Brak';
    const top3 = humanUsers[2] ? `<@${humanUsers[2].id}>` : 'Brak';

    let newDescription = `# <a:checkmark:1543969158646206475> Aktywność check\n## <a:top1:1548673656761352304> 1. ${top1}\n## <a:top2:1548673747983011891> 2. ${top2}\n## <a:top3:1548673801104138322> 3. ${top3}\n\n## <a:dot:1543969325155745812> Zareaguj emotką "<a:checkmark:1543969158646206475>" poniżej aby zaznaczyć aktywność.`;

    if (activityDescription) {
        newDescription += `\n\nOpis: ${activityDescription}`;
    }

    const updatedEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
    await message.edit({ embeds: [updatedEmbed] });
}

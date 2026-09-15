const { EmbedBuilder } = require('discord.js');

const ROLES_TO_TRACK = [
    { id: '1542127037202825326', name: '<:owner_gradient:1548652163272675452> Właściciel' },
    { id: '1542127233093869701', name: '<:admin_yellow:1548649419434627246> Współwłaściciel' },
    { id: '1543676695377215629', name: '<:admin_darkpurple:1548650402503852032> Technik' },
    { id: '1542128389274472458', name: '<:admin_red:1548649297724047450> Admin' },
    { id: '1542991925521420330', name: '<:admin_orange:1548649349834080327> Junior Admin' },
    { id: '1548662787071279145', name: '<:admin_green:1548649490964025446> Moderator' },
    { id: '1548662868960870502', name: '<:admin_lightgreen:1548663391491592295> Junior Moderator' },
    { id: '1549147393411387392', name: '<:admin_pink:1548649643502473256> Zarząd Developerów' },
    { id: '1542127336193785886', name: '<:admin_blue:1548649538389024768> Developer' },
    { id: '1549492188138709174', name: '<:admin_purple:1548649599474864228> Realizator Partnerstw' },
    { id: '1543996411350098010', name: '<:admin_turquoise:1548650090703491153> Zarząd Frakcji' }
];

async function generateStaffEmbed(guild) {
    if (guild) {
        await guild.members.fetch().catch(() => {});
    }

    let descriptionText = '# <:staff:1548644739237027902> Skład administracji serwera\n';

    if (guild) {
        for (const roleData of ROLES_TO_TRACK) {
            const role = await guild.roles.fetch(roleData.id).catch(() => null);
            
            let membersList = '<:arrow:1543977081233342494> Brak osób';
            
            if (role && role.members.size > 0) {
                membersList = role.members.map(member => `<:arrow:1543977081233342494> <@${member.id}>`).join('\n');
            }

            descriptionText += `## ${roleData.name}\n${membersList}\n`;
        }
    }

    const now = new Date();
    const formattedTime = now.toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return new EmbedBuilder()
        .setDescription(descriptionText.trim())
        .setColor(16764416)
        .setFooter({
            text: `Stworzone przez @czlekowiek • Ostatnia aktualizacja: ${formattedTime}`,
            icon_url: 'https://cdn.discordapp.com/attachments/1548638166389366834/1548644226399600680/czlekowiek-avatar-1024.png'
        });
}

module.exports = { generateStaffEmbed };

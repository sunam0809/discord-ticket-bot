require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Events,
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const express = require('express');
const fs = require('fs');
const path = require('path');

const ALLOWED_ROLE_ID = '1368030640628301865';
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

let ticketConfig = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    ticketConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    ticketConfig = {};
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(ticketConfig, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('티켓봇생성')
    .setDescription('이 채널에 티켓 패널을 생성합니다 (관리자 전용)')
    .addStringOption(opt =>
      opt.setName('제목').setDescription('티켓 패널 제목').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('설명').setDescription('티켓 패널 설명').setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('관리자역할').setDescription('티켓 문의를 보고 답할 수 있는 역할').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('티켓닫기')
    .setDescription('현재 티켓 채널을 닫습니다'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const app = express();
app.get('/', (_req, res) => res.send('🤖 Discord Ticket Bot is alive!'));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Keep-Alive] HTTP server running on port ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async c => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered globally');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === '티켓봇생성') {
      // roles.cache가 비어있을 수 있으므로 guild에서 직접 fetch
      let hasRole = interaction.member.roles.cache.has(ALLOWED_ROLE_ID);
      if (!hasRole) {
        try {
          const freshMember = await interaction.guild.members.fetch(interaction.user.id);
          hasRole = freshMember.roles.cache.has(ALLOWED_ROLE_ID);
        } catch {
          hasRole = false;
        }
      }
      if (!hasRole) {
        return interaction.reply({
          content: '❌ 이 명령어는 지정된 관리자 역할만 사용할 수 있습니다.',
          ephemeral: true,
        });
      }

      const title = interaction.options.getString('제목');
      const description = interaction.options.getString('설명');
      const adminRole = interaction.options.getRole('관리자역할');

      ticketConfig[interaction.guildId] = {
        title,
        description,
        adminRoleId: adminRole.id,
      };
      saveConfig();

      const embed = new EmbedBuilder()
        .setTitle(`🎫 ${title}`)
        .setDescription(description)
        .setColor(0x5865f2)
        .setFooter({ text: '아래 버튼을 눌러 티켓을 생성하세요.' })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('🎫 티켓 생성')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.reply({ content: '✅ 티켓 패널이 생성되었습니다!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === '티켓닫기') {
      const channel = interaction.channel;
      if (!channel.name.startsWith('티켓-')) {
        return interaction.reply({
          content: '❌ 이 채널은 티켓 채널이 아닙니다.',
          ephemeral: true,
        });
      }
      await interaction.reply({ content: '🔒 3초 후 티켓을 닫습니다...' });
      setTimeout(() => channel.delete().catch(console.error), 3000);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const config = ticketConfig[interaction.guildId];
      if (!config) {
        return interaction.reply({
          content: '❌ 티켓 설정이 없습니다. `/티켓봇생성` 명령어를 먼저 실행해 주세요.',
          ephemeral: true,
        });
      }

      const guild = interaction.guild;
      const user = interaction.user;
      const safeName = user.username.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 20) || user.id;
      const channelName = `티켓-${safeName}`;

      const existing = guild.channels.cache.find(ch => ch.name === channelName);
      if (existing) {
        return interaction.reply({
          content: `❌ 이미 열린 티켓이 있습니다: ${existing}`,
          ephemeral: true,
        });
      }

      try {
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
              ],
            },
            {
              id: config.adminRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ManageMessages,
              ],
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ],
        });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(`🎫 ${config.title}`)
          .setDescription(
            `안녕하세요, ${user}님!\n\n${config.description}\n\n궁금한 점을 자유롭게 입력해 주세요.\n관리자가 확인 후 답변드리겠습니다.`
          )
          .setColor(0x57f287)
          .setFooter({ text: '티켓을 닫으려면 아래 버튼을 누르세요.' })
          .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 티켓 닫기')
          .setStyle(ButtonStyle.Danger);

        const closeRow = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({
          content: `${user} <@&${config.adminRoleId}>`,
          embeds: [ticketEmbed],
          components: [closeRow],
        });

        await interaction.reply({
          content: `✅ 티켓이 생성되었습니다! → ${ticketChannel}`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('❌ 티켓 채널 생성 오류:', err);
        await interaction.reply({
          content: '❌ 티켓 채널 생성에 실패했습니다. 봇의 권한을 확인해 주세요.',
          ephemeral: true,
        });
      }
    }

    if (interaction.customId === 'close_ticket') {
      const channel = interaction.channel;
      await interaction.reply({ content: '🔒 3초 후 티켓을 닫습니다...' });
      setTimeout(() => channel.delete().catch(console.error), 3000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

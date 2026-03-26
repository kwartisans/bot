const { Client, Intents, Permissions } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

function createDiscordBot(config, repo) {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

  client.once("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
  });

  client.on("shardReady", (id) => console.log(`Discord shard ${id} is ready.`));
  client.on("shardError", (err) => console.error("Discord shard error:", err));
  client.on("error", (err) => console.error("Discord client error:", err));

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user, options } = interaction;
    const userId = user.id;

    const respond = async (message) => {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(message);
      }
      return interaction.reply(message);
    };

    try {
      await interaction.deferReply();
    } catch (err) {
      console.error("Failed to defer interaction:", err.message);
    }

    try {
      await repo.ensureUser(userId);

      if (commandName === "claim") {
        const result = await repo.claimCoins(userId, config.claimCooldownMs);
        if (!result.ok) {
          return respond(`Wait **${Math.ceil(result.timeLeft / 60000)} minutes** before claiming again.`);
        }
        return respond(`Claim successful: **${result.coinsEarned} coins**.`);
      }

      if (commandName === "coins") {
        const coins = await repo.getCoins(userId);
        return respond(`You have **${coins} coins**.`);
      }

      if (commandName === "give") {
        const recipient = options.getUser("username");
        const amount = options.getInteger("amount");
        if (!recipient || amount <= 0 || recipient.id === userId) return respond("Invalid give request.");

        const success = await repo.transferCoins(userId, recipient.id, amount);
        if (!success) return respond("Not enough coins.");
        return respond(`Sent **${amount} coins** to **${recipient.username}**.`);
      }

      if (commandName === "application") {
        return respond(`Internship Form: ${config.googleFormUrl}`);
      }

      if (commandName === "submit_repo") {
        const repoUrl = options.getString("repo_url");
        if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://")) return respond("Invalid URL.");
        await repo.saveRepository(userId, repoUrl);
        return respond(`Repository submitted: ${repoUrl}`);
      }

      if (commandName === "report_commits") {
        const count = options.getInteger("count");
        if (!count || count < 1) return respond("Commit count must be at least 1.");
        await repo.addCommits(userId, count);
        return respond(`Added **${count}** commits.`);
      }

      if (commandName === "approve_commits") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_GUILD);
        if (!canManageGuild) return respond("Manage Server required.");
        const target = options.getUser("student");
        const count = options.getInteger("count");
        if (!target || !count || count < 1) return respond("Invalid approval request.");
        await repo.approveCommits(target.id, count);
        return respond(`Approved **${count}** commits for **${target.username}**.`);
      }

      if (commandName === "add_achievement") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_GUILD);
        if (!canManageGuild) return respond("Manage Server required.");
        const target = options.getUser("student");
        const points = options.getInteger("points");
        if (!target || !points || points < 1) return respond("Invalid achievement request.");
        await repo.addAchievement(target.id, points);
        return respond(`Added **${points}** achievement points for **${target.username}**.`);
      }

      if (commandName === "leaderboard") {
        const rows = await repo.getLeaderboard(10);
        if (rows.length === 0) return respond("No leaderboard data yet.");
        const lines = rows.map((row, i) => `${i + 1}. <@${row.id}> | Score: ${row.score} | Coins: ${row.coins} | Achievements: ${row.achievements} | Commits: ${row.commits} | Approved: ${row.approved_commits}`);
        return respond(`Internship Leaderboard\n${lines.join("\n")}`);
      }

      return respond("Unknown command.");
    } catch (err) {
      console.error("Command error:", err.message);
      return respond("Database is unavailable. Please try again.");
    }
  });

  async function start() {
    const rest = new REST({ version: "10" }).setToken(config.botToken);
    const me = await rest.get(Routes.user());
    console.log(`Discord REST auth OK for ${me.username}#${me.discriminator}.`);
    await client.login(config.botToken);
  }

  return { client, start };
}

module.exports = { createDiscordBot };

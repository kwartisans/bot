const { Client, Intents, Permissions } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

function normalizeTaskDate(input) {
  if (!input) {
    return new Date().toISOString().slice(0, 10);
  }

  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return trimmed;
}

function createDiscordBot(config, repo, githubService) {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);
  }

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

    let deferSucceeded = false;
    try {
      await interaction.deferReply();
      deferSucceeded = true;
    } catch (err) {
      console.warn("Skipping defer (already acknowledged):", err.code);
    }

    const respond = async (message) => {
      try {
        if (deferSucceeded || interaction.deferred) {
          return interaction.editReply(message);
        } else if (interaction.replied) {
          return null;
        }
        return interaction.reply(message);
      } catch (err) {
        console.error("Response delivery failed:", err.code, err.message);
        return null;
      }
    };

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
        const githubUsername = options.getString("github_username") || "";
        if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://")) return respond("Invalid URL.");
        const saved = await repo.saveRepository(userId, repoUrl, githubUsername);
        if (saved.isGitHubRepo) {
          const usernameNote = githubUsername ? ` with GitHub author filter **${githubUsername}**` : "";
          return respond(`Repository submitted: ${repoUrl}\nGitHub sync enabled for **${saved.owner}/${saved.repo}**${usernameNote}.`);
        }
        return respond(`Repository submitted: ${repoUrl}\nNote: this is not a GitHub repo URL, so GitHub commit sync will be skipped.`);
      }

      if (commandName === "submit_daily_task") {
        const task = (options.getString("task") || "").trim();
        const dateInput = options.getString("date") || "";
        const taskDate = normalizeTaskDate(dateInput);

        if (!task || task.length < 3) return respond("Task summary must be at least 3 characters.");
        if (!taskDate) return respond("Invalid date. Use YYYY-MM-DD.");

        const result = await repo.submitDailyTask(userId, taskDate, task);
        if (result.created) {
          return respond(`Daily task recorded for **${taskDate}**.`);
        }
        return respond(`Updated your existing daily task entry for **${taskDate}**.`);
      }

      if (commandName === "sync_github_commits") {
        if (!githubService.enabled) {
          return respond("GitHub integration is not configured. Set GITHUB_TOKEN.");
        }

        try {
          const result = await repo.syncGitHubCommitsForUser(userId, githubService, {
            maxPages: config.githubMaxPages,
          });

          if (!result.ok && result.reason === "missing_repo") {
            return respond("Submit a valid GitHub repository first using /submit_repo.");
          }

          return respond(`GitHub sync complete for **${result.owner}/${result.repo}**. Added **${result.added}** new commit(s).`);
        } catch (err) {
          return respond(`GitHub sync failed: ${err.message}`);
        }
      }

      if (commandName === "sync_all_github_commits") {
        if (!githubService.enabled) {
          return respond("GitHub integration is not configured. Set GITHUB_TOKEN.");
        }

        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_GUILD);
        if (!canManageGuild) return respond("Manage Server required.");

        try {
          const result = await repo.syncGitHubCommitsForAllUsers(githubService, {
            maxPages: config.githubMaxPages,
          });

          return respond(`GitHub sync complete. Synced **${result.syncedUsers}** user(s), added **${result.totalAdded}** new commit(s).`);
        } catch (err) {
          return respond(`GitHub sync failed: ${err.message}`);
        }
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

      if (commandName === "reset_stats") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_GUILD);
        if (!canManageGuild) return respond("Manage Server required.");

        const target = options.getUser("student");
        const resetCoins = options.getBoolean("reset_coins") || false;
        if (!target) return respond("Invalid reset request.");

        await repo.resetStats(target.id, resetCoins);
        const coinsNote = resetCoins ? " Coins and cooldowns were also reset." : "";
        return respond(`Reset internship stats for **${target.username}**.${coinsNote}`);
      }

      if (commandName === "create_team") {
        const teamName = options.getString("team_name");
        const member1 = options.getUser("member_1");
        const member2 = options.getUser("member_2");
        const member3 = options.getUser("member_3");

        const memberIds = [member1, member2, member3].filter(Boolean).map((member) => member.id);
        const result = await repo.createTeam(userId, teamName, memberIds);
        if (!result.ok) return respond(result.error);

        const mentions = result.memberIds.map((id) => `<@${id}>`).join(", ");
        return respond(`Team **${result.name}** created with members: ${mentions}`);
      }

      if (commandName === "leaderboard") {
        const rows = await repo.getLeaderboard(10);
        if (rows.length === 0) return respond("No leaderboard data yet.");
        const lines = rows.map((row, i) => `${i + 1}. <@${row.id}> | Score: ${row.score} | Coins: ${row.coins} | Achievements: ${row.achievements} | Reported: ${row.commits} | GitHub: ${row.github_commits} | Approved: ${row.approved_commits} | Daily Tasks: ${row.daily_tasks_completed}`);
        return respond(`Internship Leaderboard\n${lines.join("\n")}`);
      }

      return respond("Unknown command.");
    } catch (err) {
      console.error("Command error:", err.message);
      return respond(`Request failed: ${err.message}`);
    }
  });

  async function start() {
    console.log("Starting Discord auth sequence...");
    const rest = new REST({ version: "10" }).setToken(config.botToken);

    try {
      const me = await withTimeout(rest.get(Routes.user("@me")), 10000, "Discord REST preflight");
      console.log(`Discord REST auth OK for ${me.username}#${me.discriminator}.`);
    } catch (err) {
      console.warn(`Discord REST preflight skipped: ${err.message}`);
    }

    console.log("Starting Discord gateway login...");
    await client.login(config.botToken);
  }

  return { client, start };
}

module.exports = { createDiscordBot };

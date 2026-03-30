const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require("discord.js");
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
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const TALENT_ROLE = "Talent2026";

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTransientLoginError(err) {
    const text = String((err && err.message) || err || "").toLowerCase();
    return (
      text.includes("timeout") ||
      text.includes("aborted") ||
      text.includes("econnreset") ||
      text.includes("etimedout") ||
      text.includes("network")
    );
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);
  }

  client.once("clientReady", () => {
    console.log(`Bot is online as ${client.user.tag}`);
  });

  client.on("shardReady", (id) => console.log(`Discord shard ${id} is ready.`));
  client.on("shardError", (err) => console.error("Discord shard error:", err));
  client.on("error", (err) => console.error("Discord client error:", err));

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user, options } = interaction;
    const userId = user.id;

    let deferSucceeded = false;
    try {
      await interaction.deferReply();
      deferSucceeded = true;
    } catch (err) {
      if (err && err.code === 40060) {
        console.warn("Skipping defer (already acknowledged):", err.code);
        // 40060 means interaction is already deferred; treat as success
        deferSucceeded = true;
      } else {
        console.warn("Defer failed:", err && err.code ? err.code : err.message);
      }
    }

    const respond = async (message) => {
      try {
        if (deferSucceeded) {
          return interaction.editReply(message);
        }
        return interaction.reply(message);
      } catch (err) {
        if (err && err.code === 40060) {
          try {
            return interaction.editReply(message);
          } catch (_) {
            return null;
          }
        }
        console.error("Response delivery failed:", err.code, err.message);
        return null;
      }
    };

    try {
      await repo.ensureUser(userId);

      if (commandName === "claim") {
        const result = await repo.claimCoins(userId, config.claimCooldownMs);
        if (!result.ok) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("⏳ Claim on Cooldown")
            .setDescription(`Wait **${Math.ceil(result.timeLeft / 60000)} minutes** before claiming again.`);
          return respond({ embeds: [embed] });
        }
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("🎉 Claim Successful!")
          .setDescription(`You earned **${result.coinsEarned} coins**`)
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "coins") {
        const coins = await repo.getCoins(userId);
        const embed = new EmbedBuilder()
          .setColor("#3B82F6")
          .setTitle("💰 Your Coins")
          .setDescription(`You have **${coins} coins**`);
        return respond({ embeds: [embed] });
      }

      if (commandName === "give") {
        const recipient = options.getUser("username");
        const amount = options.getInteger("amount");
        if (!recipient || amount <= 0 || recipient.id === userId) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Transfer")
            .setDescription("Check the recipient and amount.");
          return respond({ embeds: [embed] });
        }

        const success = await repo.transferCoins(userId, recipient.id, amount);
        if (!success) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Not Enough Coins")
            .setDescription(`You need **${amount}** coins but don't have enough.`);
          return respond({ embeds: [embed] });
        }
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("✅ Coins Transferred")
          .addFields(
            { name: "Sent to", value: `<@${recipient.id}>`, inline: true },
            { name: "Amount", value: `**${amount} coins**`, inline: true }
          );
        return respond({ embeds: [embed] });
      }

      if (commandName === "application") {
        const embed = new EmbedBuilder()
          .setColor("#3B82F6")
          .setTitle("📝 Internship Application")
          .setDescription(`[Click here to apply](${config.googleFormUrl})`);
        return respond({ embeds: [embed] });
      }

      if (commandName === "submit_repo") {
        const repoUrl = options.getString("repo_url");
        const githubUsername = options.getString("github_username") || "";
        if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://")) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid URL")
            .setDescription("URL must start with `http://` or `https://`");
          return respond({ embeds: [embed] });
        }
        const saved = await repo.saveRepository(userId, repoUrl, githubUsername);
        if (saved.isGitHubRepo) {
          const usernameNote = githubUsername ? ` with GitHub author filter **${githubUsername}**` : " (using repo owner as filter)";
          const embed = new EmbedBuilder()
            .setColor("#10B981")
            .setTitle("✅ Repository Submitted")
            .addFields(
              { name: "URL", value: repoUrl, inline: false },
              { name: "GitHub Repo", value: `**${saved.owner}/${saved.repo}**${usernameNote}`, inline: false }
            )
            .setTimestamp();
          return respond({ embeds: [embed] });
        }
        const embed = new EmbedBuilder()
          .setColor("#FBBF24")
          .setTitle("⚠️ Repository Submitted")
          .setDescription(repoUrl)
          .addFields({ name: "Note", value: "This is not a GitHub repo URL, so GitHub commit sync will be skipped.", inline: false });
        return respond({ embeds: [embed] });
      }

      if (commandName === "submit_daily_task") {
        const task = (options.getString("task") || "").trim();
        const dateInput = options.getString("date") || "";
        const taskDate = normalizeTaskDate(dateInput);

        if (!task || task.length < 3) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Task")
            .setDescription("Task summary must be at least 3 characters.");
          return respond({ embeds: [embed] });
        }
        if (!taskDate) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Date")
            .setDescription("Use YYYY-MM-DD format.");
          return respond({ embeds: [embed] });
        }

        const result = await repo.submitDailyTask(userId, taskDate, task);
        const color = result.created ? "#10B981" : "#3B82F6";
        const title = result.created ? "✅ Daily Task Recorded" : "✏️ Daily Task Updated";
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .addFields(
            { name: "Date", value: taskDate, inline: true },
            { name: "Task", value: task, inline: false }
          )
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "sync_github_commits") {
        if (!githubService.enabled) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ GitHub Not Configured")
            .setDescription("Set `GITHUB_TOKEN` environment variable to enable GitHub sync.");
          return respond({ embeds: [embed] });
        }

        try {
          const result = await repo.syncGitHubCommitsForUser(userId, githubService, {
            maxPages: config.githubMaxPages,
          });

          if (!result.ok && result.reason === "missing_repo") {
            const embed = new EmbedBuilder()
              .setColor("#FF6B6B")
              .setTitle("❌ No GitHub Repo Submitted")
              .setDescription("Use `/submit_repo` with a GitHub URL first.");
            return respond({ embeds: [embed] });
          }

          const embed = new EmbedBuilder()
            .setColor("#10B981")
            .setTitle("✅ GitHub Sync Complete")
            .addFields(
              { name: "Repository", value: `**${result.owner}/${result.repo}**`, inline: true },
              { name: "New Commits", value: `**${result.added}**`, inline: true }
            )
            .setTimestamp();
          return respond({ embeds: [embed] });
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ GitHub Sync Failed")
            .setDescription(err.message);
          return respond({ embeds: [embed] });
        }
      }

      if (commandName === "sync_all_github_commits") {
        if (!githubService.enabled) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ GitHub Not Configured")
            .setDescription("Set `GITHUB_TOKEN` environment variable to enable GitHub sync.");
          return respond({ embeds: [embed] });
        }

        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!canManageGuild) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Permission Denied")
            .setDescription("You need `Manage Server` permission.");
          return respond({ embeds: [embed] });
        }

        try {
          const result = await repo.syncGitHubCommitsForAllUsers(githubService, {
            maxPages: config.githubMaxPages,
          });

          const embed = new EmbedBuilder()
            .setColor("#10B981")
            .setTitle("✅ Bulk GitHub Sync Complete")
            .addFields(
              { name: "Users Synced", value: `**${result.syncedUsers}**`, inline: true },
              { name: "Total Commits Added", value: `**${result.totalAdded}**`, inline: true }
            )
            .setTimestamp();
          return respond({ embeds: [embed] });
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Sync Failed")
            .setDescription(err.message);
          return respond({ embeds: [embed] });
        }
      }

      if (commandName === "report_commits") {
        const count = options.getInteger("count");
        if (!count || count < 1) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Count")
            .setDescription("Commit count must be at least 1.");
          return respond({ embeds: [embed] });
        }
        await repo.addCommits(userId, count);
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("✅ Commits Reported")
          .setDescription(`Added **${count}** commit(s) to your progress`)
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "approve_commits") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!canManageGuild) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Permission Denied")
            .setDescription("You need `Manage Server` permission.");
          return respond({ embeds: [embed] });
        }
        const target = options.getUser("student");
        const count = options.getInteger("count");
        if (!target || !count || count < 1) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Request")
            .setDescription("Check the student and count.");
          return respond({ embeds: [embed] });
        }
        await repo.approveCommits(target.id, count);
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("✅ Commits Approved")
          .addFields(
            { name: "Student", value: `<@${target.id}>`, inline: true },
            { name: "Commits Approved", value: `**${count}**`, inline: true }
          )
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "add_achievement") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!canManageGuild) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Permission Denied")
            .setDescription("You need `Manage Server` permission.");
          return respond({ embeds: [embed] });
        }
        const target = options.getUser("student");
        const points = options.getInteger("points");
        if (!target || !points || points < 1) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Request")
            .setDescription("Check the student and points.");
          return respond({ embeds: [embed] });
        }
        await repo.addAchievement(target.id, points);
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("🏆 Achievement Awarded")
          .addFields(
            { name: "Student", value: `<@${target.id}>`, inline: true },
            { name: "Points", value: `**${points}**`, inline: true }
          )
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "reset_stats") {
        const canManageGuild = interaction.memberPermissions && interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!canManageGuild) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Permission Denied")
            .setDescription("You need `Manage Server` permission.");
          return respond({ embeds: [embed] });
        }

        const target = options.getUser("student");
        const resetCoins = options.getBoolean("reset_coins") || false;
        if (!target) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Invalid Request")
            .setDescription("Please select a student.");
          return respond({ embeds: [embed] });
        }

        await repo.resetStats(target.id, resetCoins);
        const coinsNote = resetCoins ? "\nCoins and cooldowns were also reset." : "";
        const embed = new EmbedBuilder()
          .setColor("#FBBF24")
          .setTitle("🔄 Stats Reset")
          .setDescription(`Internship stats for <@${target.id}> have been reset.${coinsNote}`)
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "create_team") {
        const teamName = options.getString("team_name");
        const member1 = options.getUser("member_1");
        const member2 = options.getUser("member_2");
        const member3 = options.getUser("member_3");

        const memberIds = [member1, member2, member3].filter(Boolean).map((member) => member.id);
        const result = await repo.createTeam(userId, teamName, memberIds);
        if (!result.ok) {
          const embed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Team Creation Failed")
            .setDescription(result.error);
          return respond({ embeds: [embed] });
        }

        const mentions = result.memberIds.map((id) => `<@${id}>`).join(", ");
        const embed = new EmbedBuilder()
          .setColor("#10B981")
          .setTitle("✅ Team Created")
          .addFields(
            { name: "Team Name", value: `**${result.name}**`, inline: false },
            { name: "Members", value: mentions || "**No members**", inline: false }
          )
          .setTimestamp();
        return respond({ embeds: [embed] });
      }

      if (commandName === "leaderboard") {
        const rows = await repo.getLeaderboard(20);
        if (rows.length === 0) {
          const noDataEmbed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("Internship Leaderboard")
            .setDescription("No leaderboard data yet.");
          return respond({ embeds: [noDataEmbed] });
        }

        try {
          const guild = interaction.guild;
          const talentRole = guild.roles.cache.find(r => r.name === TALENT_ROLE);

          if (!talentRole) {
            const embed = new EmbedBuilder()
              .setColor("#FF6B6B")
              .setTitle("Internship Leaderboard")
              .setDescription(`Role "${TALENT_ROLE}" not found in this server.`);
            return respond({ embeds: [embed] });
          }

          const filteredRows = [];
          for (const row of rows) {
            try {
              const member = await guild.members.fetch(row.id);
              if (member.roles.cache.has(talentRole.id)) {
                filteredRows.push(row);
              }
            } catch (err) {
              console.warn(`Could not check role for user ${row.id}`);
            }
          }

          if (filteredRows.length === 0) {
            const noTalentEmbed = new EmbedBuilder()
              .setColor("#FF6B6B")
              .setTitle("Internship Leaderboard")
              .setDescription(`No members with "${TALENT_ROLE}" role found yet.`);
            return respond({ embeds: [noTalentEmbed] });
          }

          const leaderboardPages = [];
          for (let i = 0; i < filteredRows.length; i += 10) {
            const pageRows = filteredRows.slice(i, i + 10);
            const embed = new EmbedBuilder()
              .setColor("#4F46E5")
              .setTitle("🏆 Internship Leaderboard")
              .setDescription(`Page ${Math.floor(i / 10) + 1} of ${Math.ceil(filteredRows.length / 10)}`)
              .setTimestamp();

            pageRows.forEach((row, idx) => {
              const rank = i + idx + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
              embed.addFields({
                name: `${medal} <@${row.id}>`,
                value: `**Score:** ${row.score} | **Coins:** ${row.coins} | **Achievements:** ${row.achievements} | **Reported:** ${row.commits} | **GitHub:** ${row.github_commits} | **Approved:** ${row.approved_commits} | **Daily Tasks:** ${row.daily_tasks_completed}`,
                inline: false,
              });
            });

            leaderboardPages.push(embed);
          }

          return respond({ embeds: [leaderboardPages[0]] });
        } catch (err) {
          const errorEmbed = new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("Error")
            .setDescription(`Failed to load leaderboard: ${err.message}`);
          return respond({ embeds: [errorEmbed] });
        }
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
      const me = await withTimeout(
        rest.get(Routes.user("@me")),
        config.discordRestPreflightTimeoutMs,
        "Discord REST preflight"
      );
      console.log(`Discord REST auth OK for ${me.username}#${me.discriminator}.`);
    } catch (err) {
      console.warn(`Discord REST preflight skipped: ${err.message}`);
    }

    console.log("Starting Discord gateway login...");
    let lastError;
    const maxAttempts = Math.max(1, config.discordLoginRetries);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await client.login(config.botToken);
        return;
      } catch (err) {
        lastError = err;
        const retryable = isTransientLoginError(err);
        const isFinalAttempt = attempt >= maxAttempts;

        if (!retryable || isFinalAttempt) {
          throw err;
        }

        console.warn(
          `Discord login attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${config.discordLoginRetryDelayMs}ms...`
        );
        await delay(config.discordLoginRetryDelayMs);
      }
    }

    throw lastError;
  }

  return { client, start };
}

module.exports = { createDiscordBot };

function createRepository(database) {
  function parseGitHubRepository(repoUrl) {
    const trimmed = (repoUrl || "").trim();
    const match = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
    if (!match) return null;

    return {
      owner: match[1],
      repo: match[2],
    };
  }

  async function ensureUser(userId) {
    await database.run("INSERT OR IGNORE INTO users (id, coins, last_work, last_claim) VALUES (?, 0, 0, 0)", [userId]);
  }

  async function ensureSubmission(userId) {
    await database.run(
      "INSERT OR IGNORE INTO internship_submissions (user_id, repo_url, achievements, commits, approved_commits, updated_at, github_owner, github_repo, github_username, github_commits, last_commit_sync_at, daily_tasks_completed) VALUES (?, '', 0, 0, 0, ?, '', '', '', 0, 0, 0)",
      [userId, Date.now()]
    );
  }

  async function getCoins(userId) {
    const row = await database.get("SELECT coins FROM users WHERE id = ?", [userId]);
    return row ? row.coins : 0;
  }

  async function transferCoins(fromUserId, toUserId, amount) {
    await ensureUser(fromUserId);
    await ensureUser(toUserId);

    const fromCoins = await getCoins(fromUserId);
    if (fromCoins < amount) return false;

    await database.run("UPDATE users SET coins = coins - ? WHERE id = ?", [amount, fromUserId]);
    await database.run("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, toUserId]);
    return true;
  }

  async function claimCoins(userId, cooldownMs) {
    await ensureUser(userId);
    const row = await database.get("SELECT last_claim FROM users WHERE id = ?", [userId]);
    const lastClaim = row ? row.last_claim : 0;
    const now = Date.now();
    const timeLeft = cooldownMs - (now - lastClaim);

    if (timeLeft > 0) return { ok: false, timeLeft };

    const coinsEarned = Math.floor(Math.random() * (350 - 220 + 1)) + 220;
    await database.run("UPDATE users SET coins = coins + ?, last_claim = ? WHERE id = ?", [coinsEarned, now, userId]);
    return { ok: true, coinsEarned };
  }

  async function saveRepository(userId, repoUrl, githubUsername = "") {
    await ensureSubmission(userId);
    const parsed = parseGitHubRepository(repoUrl);
    const normalizedUsername = (githubUsername || "").trim();

    await database.run(
      "UPDATE internship_submissions SET repo_url = ?, github_owner = ?, github_repo = ?, github_username = ?, updated_at = ? WHERE user_id = ?",
      [
        repoUrl,
        parsed ? parsed.owner : "",
        parsed ? parsed.repo : "",
        normalizedUsername,
        Date.now(),
        userId,
      ]
    );

    return {
      isGitHubRepo: Boolean(parsed),
      owner: parsed ? parsed.owner : "",
      repo: parsed ? parsed.repo : "",
    };
  }

  async function addCommits(userId, count) {
    await ensureSubmission(userId);
    await database.run("UPDATE internship_submissions SET commits = commits + ?, updated_at = ? WHERE user_id = ?", [count, Date.now(), userId]);
  }

  async function approveCommits(userId, count) {
    await ensureSubmission(userId);
    await database.run("UPDATE internship_submissions SET approved_commits = approved_commits + ?, updated_at = ? WHERE user_id = ?", [count, Date.now(), userId]);
  }

  async function addAchievement(userId, points) {
    await ensureSubmission(userId);
    await database.run("UPDATE internship_submissions SET achievements = achievements + ?, updated_at = ? WHERE user_id = ?", [points, Date.now(), userId]);
  }

  async function submitDailyTask(userId, taskDate, taskText) {
    await ensureSubmission(userId);
    const now = Date.now();

    await database.run("BEGIN TRANSACTION");
    try {
      const existing = await database.get(
        "SELECT id FROM internship_daily_tasks WHERE user_id = ? AND task_date = ?",
        [userId, taskDate]
      );

      if (existing) {
        await database.run(
          "UPDATE internship_daily_tasks SET task_text = ?, created_at = ? WHERE user_id = ? AND task_date = ?",
          [taskText, now, userId, taskDate]
        );

        await database.run(
          "UPDATE internship_submissions SET updated_at = ? WHERE user_id = ?",
          [now, userId]
        );

        await database.run("COMMIT");
        return { created: false };
      }

      await database.run(
        "INSERT INTO internship_daily_tasks (user_id, task_date, task_text, created_at) VALUES (?, ?, ?, ?)",
        [userId, taskDate, taskText, now]
      );

      await database.run(
        "UPDATE internship_submissions SET daily_tasks_completed = daily_tasks_completed + 1, updated_at = ? WHERE user_id = ?",
        [now, userId]
      );

      await database.run("COMMIT");
      return { created: true };
    } catch (err) {
      await database.run("ROLLBACK");
      throw err;
    }
  }

  async function syncGitHubCommitsForUser(userId, githubService, options = {}) {
    await ensureSubmission(userId);
    const maxPages = Number(options.maxPages || 10);
    const now = Date.now();

    if (!githubService || !githubService.enabled) {
      throw new Error("GitHub integration is disabled. Set GITHUB_TOKEN.");
    }

    const submission = await database.get(
      "SELECT github_owner, github_repo, github_username, last_commit_sync_at FROM internship_submissions WHERE user_id = ?",
      [userId]
    );

    if (!submission || !submission.github_owner || !submission.github_repo) {
      return { ok: false, reason: "missing_repo" };
    }

    const sinceIso = submission.last_commit_sync_at > 0
      ? new Date(submission.last_commit_sync_at - 60 * 1000).toISOString()
      : undefined;
    const authorFilter = submission.github_username || submission.github_owner;

    let page = 1;
    let inserted = 0;

    while (page <= maxPages) {
      const commits = await githubService.listCommits({
        owner: submission.github_owner,
        repo: submission.github_repo,
        author: authorFilter || undefined,
        since: sinceIso,
        page,
        perPage: 100,
      });

      if (!Array.isArray(commits) || commits.length === 0) break;

      for (const commit of commits) {
        if (!commit || !commit.sha) continue;

        const committedAt = commit.commit && commit.commit.author ? commit.commit.author.date : new Date().toISOString();
        const result = await database.run(
          "INSERT OR IGNORE INTO internship_synced_commits (user_id, commit_sha, committed_at, synced_at) VALUES (?, ?, ?, ?)",
          [userId, commit.sha, committedAt || new Date().toISOString(), now]
        );

        if (result && result.changes > 0) {
          inserted += 1;
        }
      }

      if (commits.length < 100) break;
      page += 1;
    }

    await database.run(
      "UPDATE internship_submissions SET github_commits = github_commits + ?, last_commit_sync_at = ?, updated_at = ? WHERE user_id = ?",
      [inserted, now, now, userId]
    );

    return {
      ok: true,
      added: inserted,
      owner: submission.github_owner,
      repo: submission.github_repo,
      pagesScanned: page,
    };
  }

  async function syncGitHubCommitsForAllUsers(githubService, options = {}) {
    const rows = await database.all(
      "SELECT user_id FROM internship_submissions WHERE github_owner <> '' AND github_repo <> ''"
    );

    let syncedUsers = 0;
    let totalAdded = 0;

    for (const row of rows) {
      const result = await syncGitHubCommitsForUser(row.user_id, githubService, options);
      if (result.ok) {
        syncedUsers += 1;
        totalAdded += result.added;
      }
    }

    return {
      syncedUsers,
      totalAdded,
    };
  }

  async function resetStats(userId, resetCoins) {
    await ensureUser(userId);
    await ensureSubmission(userId);

    await database.run(
      "UPDATE internship_submissions SET repo_url = '', achievements = 0, commits = 0, approved_commits = 0, github_owner = '', github_repo = '', github_username = '', github_commits = 0, last_commit_sync_at = 0, daily_tasks_completed = 0, updated_at = ? WHERE user_id = ?",
      [Date.now(), userId]
    );

    await database.run("DELETE FROM internship_daily_tasks WHERE user_id = ?", [userId]);
    await database.run("DELETE FROM internship_synced_commits WHERE user_id = ?", [userId]);

    if (resetCoins) {
      await database.run("UPDATE users SET coins = 0, last_work = 0, last_claim = 0 WHERE id = ?", [userId]);
    }
  }

  async function getLeaderboard(limit = 10) {
    return database.all(
      `SELECT u.id, u.coins,
              COALESCE(s.repo_url, '') AS repo_url,
              COALESCE(s.github_owner, '') AS github_owner,
              COALESCE(s.github_repo, '') AS github_repo,
              COALESCE(s.github_username, '') AS github_username,
              COALESCE(s.achievements, 0) AS achievements,
              COALESCE(s.commits, 0) AS commits,
              COALESCE(s.approved_commits, 0) AS approved_commits,
              COALESCE(s.github_commits, 0) AS github_commits,
              COALESCE(s.daily_tasks_completed, 0) AS daily_tasks_completed,
              (u.coins + (COALESCE(s.achievements, 0) * 50) + (COALESCE(s.commits, 0) * 2) + (COALESCE(s.approved_commits, 0) * 10) + (COALESCE(s.github_commits, 0) * 3) + (COALESCE(s.daily_tasks_completed, 0) * 25)) AS score
       FROM users u
       LEFT JOIN internship_submissions s ON s.user_id = u.id
       ORDER BY score DESC
       LIMIT ?`,
      [limit]
    );
  }

  async function createTeam(creatorId, teamName, memberIds = []) {
    const normalizedName = (teamName || "").trim();
    if (normalizedName.length < 2 || normalizedName.length > 40) {
      return { ok: false, error: "Team name must be 2 to 40 characters." };
    }

    const uniqueMemberIds = [...new Set([creatorId, ...memberIds].filter(Boolean))];
    if (uniqueMemberIds.length > 4) {
      return { ok: false, error: "Each team can have at most 4 members." };
    }

    const existingByName = await database.get("SELECT id FROM internship_teams WHERE LOWER(name) = LOWER(?)", [normalizedName]);
    if (existingByName) {
      return { ok: false, error: "Team name already exists." };
    }

    const placeholders = uniqueMemberIds.map(() => "?").join(",");
    const existingMembership = await database.get(
      `SELECT user_id, team_id FROM internship_team_members WHERE user_id IN (${placeholders}) LIMIT 1`,
      uniqueMemberIds
    );
    if (existingMembership) {
      return { ok: false, error: "One or more selected members are already in another team." };
    }

    for (const userId of uniqueMemberIds) {
      await ensureUser(userId);
    }

    const now = Date.now();

    await database.run("BEGIN TRANSACTION");
    try {
      const insertResult = await database.run(
        "INSERT INTO internship_teams (name, created_by, created_at) VALUES (?, ?, ?)",
        [normalizedName, creatorId, now]
      );
      const teamId = insertResult.lastID;

      for (const memberId of uniqueMemberIds) {
        await database.run(
          "INSERT INTO internship_team_members (team_id, user_id, joined_at) VALUES (?, ?, ?)",
          [teamId, memberId, now]
        );
      }

      await database.run("COMMIT");
      return { ok: true, teamId, name: normalizedName, memberIds: uniqueMemberIds };
    } catch (err) {
      await database.run("ROLLBACK");
      throw err;
    }
  }

  return {
    ensureUser,
    getCoins,
    transferCoins,
    claimCoins,
    saveRepository,
    addCommits,
    approveCommits,
    addAchievement,
    submitDailyTask,
    syncGitHubCommitsForUser,
    syncGitHubCommitsForAllUsers,
    resetStats,
    getLeaderboard,
    createTeam,
  };
}

module.exports = { createRepository };

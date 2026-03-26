function createRepository(database) {
  async function ensureUser(userId) {
    await database.run("INSERT OR IGNORE INTO users (id, coins, last_work, last_claim) VALUES (?, 0, 0, 0)", [userId]);
  }

  async function ensureSubmission(userId) {
    await database.run(
      "INSERT OR IGNORE INTO internship_submissions (user_id, repo_url, achievements, commits, approved_commits, updated_at) VALUES (?, '', 0, 0, 0, ?)",
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

  async function saveRepository(userId, repoUrl) {
    await ensureSubmission(userId);
    await database.run("UPDATE internship_submissions SET repo_url = ?, updated_at = ? WHERE user_id = ?", [repoUrl, Date.now(), userId]);
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

  async function getLeaderboard(limit = 10) {
    return database.all(
      `SELECT u.id, u.coins,
              COALESCE(s.repo_url, '') AS repo_url,
              COALESCE(s.achievements, 0) AS achievements,
              COALESCE(s.commits, 0) AS commits,
              COALESCE(s.approved_commits, 0) AS approved_commits,
              (u.coins + (COALESCE(s.achievements, 0) * 50) + (COALESCE(s.commits, 0) * 2) + (COALESCE(s.approved_commits, 0) * 10)) AS score
       FROM users u
       LEFT JOIN internship_submissions s ON s.user_id = u.id
       ORDER BY score DESC
       LIMIT ?`,
      [limit]
    );
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
    getLeaderboard,
  };
}

module.exports = { createRepository };

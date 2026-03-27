async function ensureColumn(database, tableName, columnName, definition) {
  const columns = await database.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await database.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`Database migration: added ${tableName}.${columnName}`);
  }
}

async function initializeSchema(database) {
  await database.run(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0, last_work INTEGER DEFAULT 0, last_claim INTEGER DEFAULT 0)"
  );

  await database.run(
    "CREATE TABLE IF NOT EXISTS internship_submissions (user_id TEXT PRIMARY KEY, repo_url TEXT, achievements INTEGER DEFAULT 0, commits INTEGER DEFAULT 0, approved_commits INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0)"
  );

  await database.run(
    "CREATE TABLE IF NOT EXISTS internship_daily_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, task_date TEXT NOT NULL, task_text TEXT NOT NULL, created_at INTEGER DEFAULT 0, UNIQUE(user_id, task_date))"
  );

  await database.run(
    "CREATE TABLE IF NOT EXISTS internship_synced_commits (user_id TEXT NOT NULL, commit_sha TEXT NOT NULL, committed_at TEXT NOT NULL, synced_at INTEGER DEFAULT 0, PRIMARY KEY (user_id, commit_sha))"
  );

  await database.run(
    "CREATE TABLE IF NOT EXISTS internship_teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_by TEXT NOT NULL, created_at INTEGER DEFAULT 0)"
  );

  await database.run(
    "CREATE TABLE IF NOT EXISTS internship_team_members (team_id INTEGER NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER DEFAULT 0, PRIMARY KEY (team_id, user_id), FOREIGN KEY (team_id) REFERENCES internship_teams(id) ON DELETE CASCADE)"
  );

  await ensureColumn(database, "users", "last_claim", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "repo_url", "TEXT DEFAULT ''");
  await ensureColumn(database, "internship_submissions", "achievements", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "commits", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "approved_commits", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "updated_at", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "github_owner", "TEXT DEFAULT ''");
  await ensureColumn(database, "internship_submissions", "github_repo", "TEXT DEFAULT ''");
  await ensureColumn(database, "internship_submissions", "github_username", "TEXT DEFAULT ''");
  await ensureColumn(database, "internship_submissions", "github_commits", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "last_commit_sync_at", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "daily_tasks_completed", "INTEGER DEFAULT 0");
}

module.exports = { initializeSchema };

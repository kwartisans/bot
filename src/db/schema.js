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

  await ensureColumn(database, "users", "last_claim", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "repo_url", "TEXT DEFAULT ''");
  await ensureColumn(database, "internship_submissions", "achievements", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "commits", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "approved_commits", "INTEGER DEFAULT 0");
  await ensureColumn(database, "internship_submissions", "updated_at", "INTEGER DEFAULT 0");
}

module.exports = { initializeSchema };

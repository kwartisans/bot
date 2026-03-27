const { getConfig } = require("./config");
const { openDatabase } = require("./db/client");
const { initializeSchema } = require("./db/schema");
const { createRepository } = require("./db/repository");
const { createWebServer } = require("./web/server");
const { createDiscordBot } = require("./bot/discord");
const { createGitHubService } = require("./github/service");

async function main() {
  try {
    const config = getConfig();
    const database = openDatabase();

    await initializeSchema(database);
    console.log("Database schema is ready.");

    const repository = createRepository(database);
    const githubService = createGitHubService(config);

    const webServer = createWebServer(config, repository);
    webServer.start();

    const bot = createDiscordBot(config, repository, githubService);
    await bot.start();
    console.log("Discord gateway login request sent.");
  } catch (err) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
}

main();

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { commandDefinitions } = require("./commands/definitions");
require("dotenv").config();

const requiredEnvVars = ["BOT_TOKEN", "CLIENT_ID", "GUILD_ID"];
const missingVars = requiredEnvVars.filter((name) => !process.env[name] || !process.env[name].trim());

if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
    process.exit(1);
}

const botToken = process.env.BOT_TOKEN.trim();
const botID = process.env.CLIENT_ID.trim();
const serverID = process.env.GUILD_ID.trim();

const commands = commandDefinitions;

const rest = new REST({ version: "10" }).setToken(botToken);

(async () => {
    try {
        console.log("Registering slash commands...");
        await rest.put(Routes.applicationGuildCommands(botID, serverID), { body: commands });
        console.log("Slash commands registered successfully!");
    } catch (error) {
        console.error("Failed to register slash commands:", error.message);
        if (error.response) {
            console.error("Details:", error.response.data);
        }
    }
})();


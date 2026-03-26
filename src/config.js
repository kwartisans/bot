require("dotenv").config();

const requiredEnv = ["BOT_TOKEN"];
const optionalEnv = ["CLIENT_ID", "GUILD_ID", "GOOGLE_FORM_URL"];

function missingVars(names) {
  return names.filter((name) => !process.env[name] || !process.env[name].trim());
}

function validateEnv() {
  const missingRequired = missingVars(requiredEnv);
  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(", ")}`);
  }

  const missingOptional = missingVars(optionalEnv);
  if (missingOptional.length > 0) {
    console.warn(`Missing optional environment variables: ${missingOptional.join(", ")}`);
  }
}

function getConfig() {
  validateEnv();
  const botToken = process.env.BOT_TOKEN.trim();
  const tokenParts = botToken.split(".");

  if (tokenParts.length !== 3) {
    throw new Error("BOT_TOKEN format looks invalid.");
  }

  return {
    botToken,
    clientId: process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : "",
    guildId: process.env.GUILD_ID ? process.env.GUILD_ID.trim() : "",
    googleFormUrl: process.env.GOOGLE_FORM_URL || "https://docs.google.com/forms/d/e/1FAIpQLSerzre1mv308QHfnP5wyKU1mQ1pSf0B1P5hsSpx3tjz-niIyQ/viewform?usp=header",
    port: Number(process.env.PORT || 3000),
    claimCooldownMs: 60 * 60 * 1000,
  };
}

module.exports = { getConfig };

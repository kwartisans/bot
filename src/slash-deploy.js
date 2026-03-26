
const { REST, Routes } = require("discord.js");
require("dotenv").config();

const botToken = process.env.BOT_TOKEN;
const botID = process.env.CLIENT_ID; // Ensure this is set in .env
const serverID = process.env.GUILD_ID; // Ensure this is set in .env

if (!botToken || !botID || !serverID) {
    console.error("Error: BOT_TOKEN, CLIENT_ID, or GUILD_ID is not defined in the .env file.");
    process.exit(1);
}

const commands = [
    {
        name: "work",
        description: "Earn random coins every 1 hour (200-300).",
    },
    {
        name: "coins",
        description: "Check your total coins.",
    },
    {
        name: "give",
        description: "Give coins to another user.",
        options: [
            {
                name: "username",
                type: 6, // USER
                description: "User to give coins to.",
                required: true,
            },
            {
                name: "amount",
                type: 4, // INTEGER
                description: "Amount of coins to give.",
                required: true,
            },
        ],
    },
    {
        name: "add",
        description: "Add a user to the private channel.",
        options: [
            {
                name: "username",
                type: 6, // USER
                description: "User to add.",
                required: true,
            },
        ],
    },
    {
        name: "create_team",
        description: "Create a team channel.",
        options: [
            {
                name: "teamname",
                type: 3, // STRING
                description: "The name of the team channel.",
                required: true,
            },
        ],
    },
    {
        name: "buy",
        description: "Buy tiers or forms.",
        options: [
            {
                name: "tiers",
                type: 1, // Subcommand
                description: "Choose a tier to buy",
                options: [
                    {
                        name: "tier",
                        type: 3, // STRING
                        description: "Choose a tier to buy",
                        required: true,
                        choices: [
                            { name: "T1", value: "t1" },
                            { name: "T2", value: "t2" },
                            { name: "T3", value: "t3" },
                            { name: "T4", value: "t4" },
                        ],
                    },
                ],
            },
            {
                name: "forms",
                type: 1, // Subcommand
                description: "Choose a form to buy",
                options: [
                    {
                        name: "form",
                        type: 3, // STRING
                        description: "Choose a form",
                        required: true,
                        choices: [
                            { name: "Registration", value: "registration" },
                            { name: "Submission", value: "submission" },
                        ],
                    },
                ],
            },
        ],
    },
];

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


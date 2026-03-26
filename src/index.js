const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000; // Render will provide a PORT value, Setting up a server
app.get("/", (req, res) => {
    res.send("Bot is running! 🚀");
});

app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});



const { Client, GatewayIntentBits, Partials, ChannelType } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

// Database setup
const db = new sqlite3.Database("./coins.db", (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
    console.log("Connected to SQLite database.");
});

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 0,
        last_work INTEGER DEFAULT 0
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        teamname TEXT,
        members TEXT
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        team_id TEXT,
        channel_id TEXT
    )
`);

const TIER_PRICES = { t1: 1000, t2: 2000, t3: 5000, t4: 10000 };
const REGISTRATION_PRICE = 2500;

// Bot ready
client.once("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// Slash commands handling
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user, options } = interaction;

    if (commandName === "buy") {
        const category = options.getSubcommand();
        const tier = category === "tiers" ? options.getString("tier") : null;
        const form = category === "forms" ? options.getString("form") : null;
        const userId = user.id;

        db.get("SELECT coins FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) {
                console.error("Database error:", err.message);
                return interaction.reply("⚠️ An error occurred while retrieving your coins.");
            }

            const coins = row ? row.coins : 0;

            if (category === "tiers") {
                if (!tier || !TIER_PRICES[tier]) {
                    return interaction.reply("⚠️ Invalid tier selected. Choose from T1, T2, T3, or T4.");
                }

                const price = TIER_PRICES[tier];
                if (coins < price) {
                    return interaction.reply(`🚫 You don't have enough coins to buy **${tier.toUpperCase()}**.`);
                }

                db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [price, userId], (err) => {
                    if (err) {
                        console.error("Database update error:", err.message);
                        return interaction.reply("⚠️ Failed to process your purchase.");
                    }
                    interaction.reply(`✅ You successfully purchased **${tier.toUpperCase()}** for **${price} coins**!`);

                    // Assign role with icon for the tier
                    const tierRoleName = `Tier ${tier.toUpperCase()}`;
                    let roleIcon;
                    switch(tier) {
                        case 't1': roleIcon = '🟢'; break;
                        case 't2': roleIcon = '🟠'; break;
                        case 't3': roleIcon = '🔵'; break;
                        case 't4': roleIcon = '🟣'; break;
                        default: roleIcon = '⚪';
                    }

                    let role = interaction.guild.roles.cache.find(r => r.name === tierRoleName);
                    if (!role) {
                        interaction.guild.roles.create({
                            name: tierRoleName,
                            color: '#0000FF',
                            hoist: true,
                            unicodeEmoji: roleIcon,
                        }).then(newRole => {
                            const member = interaction.guild.members.cache.get(userId);
                            if (member) {
                                member.roles.add(newRole).catch(console.error);
                            }
                        }).catch(console.error);
                    }
                });
            } else if (category === "forms") {
                if (!form || (form !== "registration" && form !== "submission")) {
                    return interaction.reply("⚠️ Invalid form selected. Choose either Registration or Submission.");
                }

                if (form === "registration") {
                    if (coins < REGISTRATION_PRICE) {
                        return interaction.reply(`🚫 You don't have enough coins for registration. It costs **${REGISTRATION_PRICE} coins**.`);
                    }

                    db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [REGISTRATION_PRICE, userId], (err) => {
                        if (err) {
                            console.error("Database update error:", err.message);
                            return interaction.reply("⚠️ Failed to process your registration.");
                        }
                        interaction.reply(`✅ You successfully registered for **${REGISTRATION_PRICE} coins**!`);

                        // Add icon role for registration
                        const registrationRoleName = `Registration`;
                        const registrationIcon = '📝';

                        let registrationRole = interaction.guild.roles.cache.find(r => r.name === registrationRoleName);
                        if (!registrationRole) {
                            interaction.guild.roles.create({
                                name: registrationRoleName,
                                color: '#00FF00',
                                hoist: true,
                                unicodeEmoji: registrationIcon,
                            }).then(newRole => {
                                const member = interaction.guild.members.cache.get(userId);
                                if (member) {
                                    member.roles.add(newRole).catch(console.error);
                                }
                            }).catch(console.error);
                        }
                    });
                } else if (form === "submission") {
                    interaction.reply("✅ You chose the **Submission** form.");
                }
            } else {
                interaction.reply("⚠️ Invalid category selected.");
            }
        });
    } else if (commandName === "work") {
        const userId = user.id;
        const currentTime = Date.now();
        const workCooldown = 3600000; // 1 hour cooldown

        db.get("SELECT last_work FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) {
                console.error("Database error:", err.message);
                return interaction.reply("⚠️ An error occurred.");
            }

            const lastWork = row ? row.last_work : 0;
            const timeLeft = workCooldown - (currentTime - lastWork);

            if (timeLeft > 0) {
                return interaction.reply(`⏳ You can work again in **${Math.ceil(timeLeft / 60000)} minutes**.`);
            }

            const coinsEarned = Math.floor(Math.random() * (300 - 200 + 1)) + 200;
            db.run("INSERT OR IGNORE INTO users (id) VALUES (?)", [userId], (err) => {
                if (err) {
                    console.error("Database insert error:", err.message);
                    return interaction.reply("⚠️ Failed to earn coins.");
                }
                db.run("UPDATE users SET coins = coins + ?, last_work = ? WHERE id = ?", [coinsEarned, currentTime, userId], (err) => {
                    if (err) {
                        console.error("Database update error:", err.message);
                        return interaction.reply("⚠️ Failed to earn coins.");
                    }
                    interaction.reply(`✅ You earned **${coinsEarned} coins**!`);
                });
            });
        });
    } else if (commandName === "coins") {
        const userId = user.id;

        db.get("SELECT coins FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) {
                console.error("Database error:", err.message);
                return interaction.reply("⚠️ An error occurred.");
            }

            const coins = row ? row.coins : 0;
            interaction.reply(`💰 You currently have **${coins} coins**.`);
        });
    } else if (commandName === "give") {
        const recipient = options.getUser("username");
        const amount = options.getInteger("amount");
        const userId = user.id;

        if (recipient.id === userId) {
            return interaction.reply("🚫 You cannot give coins to yourself.");
        }

        db.get("SELECT coins FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) {
                console.error("Database error:", err.message);
                return interaction.reply("⚠️ An error occurred.");
            }

            const coins = row ? row.coins : 0;
            if (coins < amount) {
                return interaction.reply(`🚫 You don't have enough coins to give **${amount} coins**.`);
            }

            db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [amount, userId], (err) => {
                if (err) {
                    console.error("Database update error:", err.message);
                    return interaction.reply("⚠️ Failed to process your transfer.");
                }
                db.run("INSERT OR IGNORE INTO users (id) VALUES (?)", [recipient.id], (err) => {
                    if (err) {
                        console.error("Database insert error:", err.message);
                        return interaction.reply("⚠️ Failed to process the recipient's coins.");
                    }
                    db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, recipient.id], (err) => {
                        if (err) {
                            console.error("Database update error:", err.message);
                            return interaction.reply("⚠️ Failed to process the recipient's coins.");
                        }
                        interaction.reply(`✅ You gave **${amount} coins** to **${recipient.username}**!`);
                    });
                });
            });
        });
    } else if (commandName === "add") {
        const userToAdd = options.getUser("username");

        interaction.guild.channels.create({
            name: `private-${userToAdd.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: ["ViewChannel"],
                },
                {
                    id: userToAdd.id,
                    allow: ["ViewChannel", "SendMessages"],
                },
            ],
        }).then(channel => {
            interaction.reply(`✅ Added **${userToAdd.username}** to a private channel: ${channel.name}.`);
        }).catch(err => {
            console.error("Error creating private channel:", err.message);
            interaction.reply("⚠️ Failed to add user to private channel.");
        });
    } else if (commandName === "create_team") {
        const teamName = options.getString("teamname");
        const teamId = `${teamName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

        db.run("INSERT INTO teams (id, teamname, members) VALUES (?, ?, ?)", [teamId, teamName, "[]"], (err) => {
            if (err) {
                console.error("Error creating team:", err.message);
                return interaction.reply("⚠️ Failed to create team.");
            }

            interaction.reply(`✅ Team **${teamName}** created successfully!`);
        });
    }
});

// Handle runtime errors
client.on("error", (err) => {
    console.error("Discord client error:", err.message);
});

// Login bot
client.login(process.env.BOT_TOKEN)
    .then(() => console.log("Discord login successful."))
    .catch((err) => console.error("Discord login failed:", err.message));

const { ApplicationCommandOptionType } = require("discord.js");

const commandDefinitions = [
  { name: "claim", description: "Claim internship coins (with cooldown)." },
  { name: "coins", description: "Check your total coins." },
  {
    name: "give",
    description: "Give coins to another user.",
    options: [
      { name: "username", type: ApplicationCommandOptionType.User, description: "User to give coins to.", required: true },
      { name: "amount", type: ApplicationCommandOptionType.Integer, description: "Amount of coins to give.", required: true },
    ],
  },
  { name: "application", description: "Get the internship Google Form link." },
  {
    name: "submit_repo",
    description: "Submit your internship repository URL.",
    options: [
      { name: "repo_url", type: ApplicationCommandOptionType.String, description: "Repository URL", required: true },
      { name: "github_username", type: ApplicationCommandOptionType.String, description: "GitHub username (optional for commit filtering)", required: false },
    ],
  },
  {
    name: "submit_daily_task",
    description: "Submit your daily internship task completion.",
    options: [
      { name: "task", type: ApplicationCommandOptionType.String, description: "Task summary for today", required: true },
      { name: "date", type: ApplicationCommandOptionType.String, description: "Date in YYYY-MM-DD (optional, defaults to today UTC)", required: false },
    ],
  },
  { name: "sync_github_commits", description: "Sync your GitHub commits from your submitted repo." },
  { name: "sync_all_github_commits", description: "Admin: sync GitHub commits for all interns." },
  {
    name: "report_commits",
    description: "Report newly completed commits.",
    options: [
      { name: "count", type: ApplicationCommandOptionType.Integer, description: "Commit count", required: true },
    ],
  },
  {
    name: "approve_commits",
    description: "Admin: approve student commits.",
    options: [
      { name: "student", type: ApplicationCommandOptionType.User, description: "Student user", required: true },
      { name: "count", type: ApplicationCommandOptionType.Integer, description: "Approved commit count", required: true },
    ],
  },
  {
    name: "add_achievement",
    description: "Admin: add achievement points.",
    options: [
      { name: "student", type: ApplicationCommandOptionType.User, description: "Student user", required: true },
      { name: "points", type: ApplicationCommandOptionType.Integer, description: "Achievement points", required: true },
    ],
  },
  {
    name: "reset_stats",
    description: "Admin: reset a student's internship stats.",
    options: [
      { name: "student", type: ApplicationCommandOptionType.User, description: "Student user", required: true },
      { name: "reset_coins", type: ApplicationCommandOptionType.Boolean, description: "Also reset coins", required: false },
    ],
  },
  {
    name: "create_team",
    description: "Create an internship team with up to 4 members.",
    options: [
      { name: "team_name", type: ApplicationCommandOptionType.String, description: "Unique team name", required: true },
      { name: "member_1", type: ApplicationCommandOptionType.User, description: "First teammate", required: false },
      { name: "member_2", type: ApplicationCommandOptionType.User, description: "Second teammate", required: false },
      { name: "member_3", type: ApplicationCommandOptionType.User, description: "Third teammate", required: false },
    ],
  },
  { name: "leaderboard", description: "Show internship leaderboard by score." },
];

module.exports = { commandDefinitions };

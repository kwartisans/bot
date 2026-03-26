const commandDefinitions = [
  { name: "claim", description: "Claim internship coins (with cooldown)." },
  { name: "coins", description: "Check your total coins." },
  {
    name: "give",
    description: "Give coins to another user.",
    options: [
      { name: "username", type: 6, description: "User to give coins to.", required: true },
      { name: "amount", type: 4, description: "Amount of coins to give.", required: true },
    ],
  },
  { name: "application", description: "Get the internship Google Form link." },
  {
    name: "submit_repo",
    description: "Submit your internship repository URL.",
    options: [
      { name: "repo_url", type: 3, description: "Repository URL", required: true },
    ],
  },
  {
    name: "report_commits",
    description: "Report newly completed commits.",
    options: [
      { name: "count", type: 4, description: "Commit count", required: true },
    ],
  },
  {
    name: "approve_commits",
    description: "Admin: approve student commits.",
    options: [
      { name: "student", type: 6, description: "Student user", required: true },
      { name: "count", type: 4, description: "Approved commit count", required: true },
    ],
  },
  {
    name: "add_achievement",
    description: "Admin: add achievement points.",
    options: [
      { name: "student", type: 6, description: "Student user", required: true },
      { name: "points", type: 4, description: "Achievement points", required: true },
    ],
  },
  { name: "leaderboard", description: "Show internship leaderboard by score." },
];

module.exports = { commandDefinitions };

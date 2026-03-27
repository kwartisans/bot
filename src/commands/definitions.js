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
      { name: "github_username", type: 3, description: "GitHub username (optional for commit filtering)", required: false },
    ],
  },
  {
    name: "submit_daily_task",
    description: "Submit your daily internship task completion.",
    options: [
      { name: "task", type: 3, description: "Task summary for today", required: true },
      { name: "date", type: 3, description: "Date in YYYY-MM-DD (optional, defaults to today UTC)", required: false },
    ],
  },
  { name: "sync_github_commits", description: "Sync your GitHub commits from your submitted repo." },
  { name: "sync_all_github_commits", description: "Admin: sync GitHub commits for all interns." },
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
  {
    name: "reset_stats",
    description: "Admin: reset a student's internship stats.",
    options: [
      { name: "student", type: 6, description: "Student user", required: true },
      { name: "reset_coins", type: 5, description: "Also reset coins", required: false },
    ],
  },
  {
    name: "create_team",
    description: "Create an internship team with up to 4 members.",
    options: [
      { name: "team_name", type: 3, description: "Unique team name", required: true },
      { name: "member_1", type: 6, description: "First teammate", required: false },
      { name: "member_2", type: 6, description: "Second teammate", required: false },
      { name: "member_3", type: 6, description: "Third teammate", required: false },
    ],
  },
  { name: "leaderboard", description: "Show internship leaderboard by score." },
];

module.exports = { commandDefinitions };

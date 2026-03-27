# Internship Bot Command Guide

This guide is for new interns joining the Discord server.
Use it to understand every command, when to use it, and what each command does.

## Quick Start

1. Open the internship Discord server.
2. Type `/` and choose a command from the bot.
3. Fill in command options if needed.
4. Submit and read the bot response.

## Command Overview

### Intern Commands

#### `/claim`
- Purpose: Claim internship coins (cooldown applies).
- Use when: You want to earn coins regularly.
- Example: `/claim`
- Result: You receive random coins if your cooldown is finished.

#### `/coins`
- Purpose: Check your coin balance.
- Example: `/coins`
- Result: Bot shows your current total coins.

#### `/give username:<user> amount:<number>`
- Purpose: Send your coins to another intern.
- Rules:
- Amount must be greater than 0.
- You cannot send coins to yourself.
- You must have enough coins.
- Example: `/give username:@Alex amount:50`
- Result: Coins are moved from your account to your teammate.

#### `/application`
- Purpose: Get the official internship application form link.
- Example: `/application`
- Result: Bot posts the Google Form URL.

#### `/submit_repo repo_url:<url>`
- Purpose: Save/update your internship repository URL.
- Rules:
- URL must start with `http://` or `https://`.
- If it's a GitHub URL, GitHub commit sync can use it.
- `github_username` is optional but recommended to filter commits by author.
- Example: `/submit_repo repo_url:https://github.com/yourname/internship-project`
- Result: Your repo link is saved in the system.

#### `/submit_daily_task task:<text> date:<YYYY-MM-DD optional>`
- Purpose: Submit your daily internship task completion.
- Rules:
- Task text must be at least 3 characters.
- Date defaults to today (UTC) when omitted.
- One entry per user per date; resubmitting updates that date's task text.
- Example: `/submit_daily_task task:Built login form and fixed validation date:2026-03-27`
- Result: Daily completion is recorded and adds to leaderboard points.

#### `/sync_github_commits`
- Purpose: Pull your new commits from the GitHub repo you submitted.
- Requirements:
- Bot must have `GITHUB_TOKEN` configured.
- Your repo should be submitted with `/submit_repo`.
- Example: `/sync_github_commits`
- Result: New commits are deduplicated and added to your GitHub commit count.

#### `/sync_all_github_commits`
- Purpose: Admin sync for all interns with configured GitHub repos.
- Permission: Manage Server required.
- Example: `/sync_all_github_commits`
- Result: Synces GitHub commits for all registered interns.

#### `/report_commits count:<number>`
- Purpose: Report the number of new commits you completed.
- Rules:
- Count must be at least 1.
- Example: `/report_commits count:4`
- Result: Your reported commits are added to your progress.

#### `/leaderboard`
- Purpose: View top internship scores.
- Example: `/leaderboard`
- Result: Shows ranking with score, coins, achievements, commits, and approved commits.

#### `/create_team team_name:<name> member_1:<user> member_2:<user> member_3:<user>`
- Purpose: Create your internship team.
- Rules:
- Team name must be unique and 2 to 40 characters.
- Max team size is 4 people total (you + up to 3 members).
- A user can only belong to one team.
- `member_1`, `member_2`, and `member_3` are optional.
- Example: `/create_team team_name:Code Rangers member_1:@Maya member_2:@Jon`
- Result: A new team is created and members are registered.

### Admin Commands (Manage Server permission required)

#### `/approve_commits student:<user> count:<number>`
- Purpose: Approve student commits.
- Rules:
- Count must be at least 1.
- Example: `/approve_commits student:@Alex count:5`
- Result: Approved commits are added to the selected student.

#### `/add_achievement student:<user> points:<number>`
- Purpose: Award achievement points.
- Rules:
- Points must be at least 1.
- Example: `/add_achievement student:@Alex points:3`
- Result: Achievement points are added to that student.

#### `/reset_stats student:<user> reset_coins:<true|false>`
- Purpose: Reset a student's internship stats.
- `reset_coins:true` also resets coin balance and claim cooldown.
- Example: `/reset_stats student:@Alex reset_coins:true`
- Result: Student internship tracking is reset.

## How Scoring Works

Leaderboard score is calculated as:
- `coins`
- `+ achievements * 50`
- `+ reported_commits * 2`
- `+ github_commits * 3`
- `+ approved_commits * 10`
- `+ daily_tasks_completed * 25`

## Common Problems

- "Invalid URL" on `/submit_repo`:
- Make sure the URL starts with `http://` or `https://`.

- "Not enough coins" on `/give`:
- Use `/coins` to check your balance first.

- Team creation fails:
- Make sure the name is unique.
- Check that no selected member is already in another team.
- Keep team size within 4 total members.

## For Bot Maintainers

### Environment Variables

- Required:
- `BOT_TOKEN`
- Optional:
- `CLIENT_ID`
- `GUILD_ID`
- `GOOGLE_FORM_URL`
- `GITHUB_TOKEN` (required for GitHub commit sync commands)
- `GITHUB_API_VERSION` (default `2026-03-10`)
- `GITHUB_MAX_PAGES` (default `10`)

When command definitions are changed, re-register slash commands:

```bash
npm run deploy-commands
```

Then restart the bot if needed:

```bash
npm start
```

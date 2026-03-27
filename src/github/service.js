const { Octokit } = require("@octokit/core");

function createGitHubService(config) {
  const enabled = Boolean(config.githubToken);

  if (!enabled) {
    return {
      enabled: false,
      async listCommits() {
        throw new Error("GitHub integration is disabled. Set GITHUB_TOKEN.");
      },
    };
  }

  const octokit = new Octokit({ auth: config.githubToken });

  async function listCommits({ owner, repo, author, since, page = 1, perPage = 100 }) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      author,
      since,
      page,
      per_page: perPage,
      headers: {
        accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": config.githubApiVersion,
      },
    });

    return response.data || [];
  }

  return {
    enabled: true,
    listCommits,
  };
}

module.exports = { createGitHubService };

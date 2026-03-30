let octokitConstructorPromise;

async function getOctokitConstructor() {
  if (!octokitConstructorPromise) {
    octokitConstructorPromise = import("@octokit/core").then((mod) => mod.Octokit);
  }

  return octokitConstructorPromise;
}

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

  let octokit;

  async function getOctokit() {
    if (!octokit) {
      const Octokit = await getOctokitConstructor();
      octokit = new Octokit({ auth: config.githubToken });
    }

    return octokit;
  }

  async function listCommits({ owner, repo, author, since, page = 1, perPage = 100 }) {
    const githubClient = await getOctokit();
    const response = await githubClient.request("GET /repos/{owner}/{repo}/commits", {
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

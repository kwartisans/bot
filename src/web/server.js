const path = require("path");
const express = require("express");

function createWebServer(config, repo) {
  const app = express();
  const publicDir = path.join(__dirname, "public");

  app.use(express.static(publicDir));

  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "leaderboard.html"));
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const rows = await repo.getLeaderboard(20);
      res.json({ items: rows });
    } catch (err) {
      res.status(500).json({ error: "Failed to load leaderboard" });
    }
  });

  function start() {
    app.listen(config.port, () => {
      console.log(`HTTP server listening on port ${config.port}`);
    });
  }

  return { start };
}

module.exports = { createWebServer };

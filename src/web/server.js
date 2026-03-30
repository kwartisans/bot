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
    const maxAttempts = 10;
    let port = config.port;

    return new Promise((resolve, reject) => {
      const tryListen = (attempt) => {
        const server = app.listen(port, () => {
          console.log(`HTTP server listening on port ${port}`);
          resolve(server);
        });

        server.on("error", (err) => {
          if (err && err.code === "EADDRINUSE" && attempt < maxAttempts) {
            console.warn(`Port ${port} is in use. Trying port ${port + 1}...`);
            port += 1;
            setTimeout(() => tryListen(attempt + 1), 50);
            return;
          }

          reject(err);
        });
      };

      tryListen(1);
    });
  }

  return { start };
}

module.exports = { createWebServer };

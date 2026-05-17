import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "16kb" }));

  // Per-IP rate limiter: max 10 requests per 60s window
  const errorRateMap = new Map<string, { count: number; resetAt: number }>();
  const ERROR_RATE_LIMIT = 10;
  const ERROR_RATE_WINDOW_MS = 60_000;

  // Error beacon endpoint — receives client-side ErrorBoundary reports
  app.post("/api/errors", (req, res) => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";

    const now = Date.now();
    const entry = errorRateMap.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= ERROR_RATE_LIMIT) {
        res.status(429).json({ error: "Too many requests" });
        return;
      }
      entry.count += 1;
    } else {
      errorRateMap.set(ip, { count: 1, resetAt: now + ERROR_RATE_WINDOW_MS });
    }

    const { message, url, timestamp, stack } = req.body ?? {};
    console.error("[client-error]", { message, url, timestamp, stack });
    res.status(204).end();
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

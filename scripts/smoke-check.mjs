import { spawn } from "node:child_process";

const PORT = 4177;
const baseUrl = `http://127.0.0.1:${PORT}`;
const routes = [
  "/",
  "/eb-1-india",
  "/eb-2-india",
  "/eb-3-india",
  "/methodology",
  "/visa-bulletin-history",
  "/robots.txt",
  "/sitemap.xml",
];

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for smoke server")),
      10000
    );
    child.stdout.on("data", chunk => {
      if (String(chunk).includes(`localhost:${PORT}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", chunk => {
      const text = String(chunk);
      if (text.includes("EADDRINUSE") || text.includes("EACCES")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
    child.on("exit", code => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Smoke server exited with ${code}`));
      }
    });
  });
}

const child = spawn(process.execPath, ["dist/index.js"], {
  env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(child);
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    if (!response.ok) {
      throw new Error(`${route} returned ${response.status}`);
    }
    const body = await response.text();
    if (route === "/" && !body.includes("EB India Priority Date Tracker")) {
      throw new Error("Home page is missing expected title text");
    }
    if (route === "/robots.txt" && !body.includes("Sitemap:")) {
      throw new Error("robots.txt is missing sitemap reference");
    }
    if (route === "/sitemap.xml" && !body.includes("<urlset")) {
      throw new Error("sitemap.xml is missing urlset");
    }
  }
  console.log(`Smoke checks passed for ${routes.length} routes.`);
} finally {
  child.kill();
}

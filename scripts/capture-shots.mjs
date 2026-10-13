// Captures a screenshot of each featured repo's live site into public/shots/<repo>.webp.
// Repos with no live site can point at a standalone HTML file inside the repo (REPO_PAGES).
// Repos with neither get no image; the scene renders a typographic panel for them instead.
// Usage: npm run capture:shots   (set BROWSER=path\to\chrome.exe to override)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const outDir = fileURLToPath(new URL("public/shots/", root));
mkdirSync(outDir, { recursive: true });

const { repos: allRepos, profile } = JSON.parse(readFileSync(new URL("src/data/github.json", root), "utf8"));
// Only the repos featured on the walk get a screenshot (keep in sync with FEATURED in src/data/projects.js).
const FEATURED = ["doable", "algo-trading", "mishri-sweet-house", "iphone-6-app", "ETI--main"];
const repos = allRepos.filter((r) => FEATURED.includes(r.name));

// Standalone pages inside repos that have no deployment. Captured at phone size.
const REPO_PAGES = {
  "iphone-6-app": { path: "companion.html", size: "520,980", scale: 2 },
};

const browser = [
  process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => p && existsSync(p));

if (!browser) {
  console.error("No Chrome or Edge found. Set BROWSER to a Chromium executable.");
  process.exit(1);
}

function shoot(url, file, size = "1600,1000", scale = 1) {
  execFileSync(
    browser,
    [
      "--headless=new",
      "--hide-scrollbars",
      `--force-device-scale-factor=${scale}`,
      // Long budget so intro sequences (ETI) finish before the capture.
      "--virtual-time-budget=30000",
      `--window-size=${size}`,
      `--screenshot=${file}`,
      url,
    ],
    { stdio: "ignore", timeout: 90000 }
  );
}

for (const repo of repos) {
  const file = join(outDir, `${repo.name}.png`);
  const live = repo.homepage && !repo.homepage.includes("replit.com");
  const page = REPO_PAGES[repo.name];
  try {
    if (live) {
      shoot(repo.homepage, file);
      console.log(`shot  ${repo.name}  <- ${repo.homepage}`);
    } else if (page) {
      const res = await fetch(
        `https://raw.githubusercontent.com/${profile.login}/${repo.name}/HEAD/${page.path}`
      );
      const tmp = join(tmpdir(), `${repo.name}-${page.path}`);
      writeFileSync(tmp, await res.text());
      shoot(pathToFileURL(tmp).href, file, page.size, page.scale);
      rmSync(tmp);
      console.log(`shot  ${repo.name}  <- ${page.path}`);
    } else {
      rmSync(file, { force: true });
      console.log(`none  ${repo.name}  (typographic panel)`);
    }
  } catch (err) {
    console.warn(`failed ${repo.name}: ${err.message}`);
  }
}

// Shrink the PNGs to WebP for the site.
await import("./optimize-shots.mjs");

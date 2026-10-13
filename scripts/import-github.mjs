// Pulls public repos from GitHub, ranks them, and writes src/data/github.json.
// Usage: npm run import:github [-- username]
// Auth: uses GITHUB_TOKEN if set, otherwise `gh auth token`, otherwise unauthenticated (60 req/h).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const USER = process.argv[2] || "AdiTheCoder00";
const TOP_N = 8;

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const headers = { Accept: "application/vnd.github+json", "User-Agent": "portfolio-import" };
const t = token();
if (t) headers.Authorization = `Bearer ${t}`;

async function gh(path, raw = false) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (raw) return res; // callers check res.ok (an empty repo answers 409 on /commits)
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function commitCount(repo) {
  const res = await gh(`/repos/${USER}/${repo}/commits?per_page=1`, true);
  if (!res.ok) return 0;
  const last = res.headers.get("link")?.match(/page=(\d+)>; rel="last"/);
  return last ? Number(last[1]) : (await res.json()).length;
}

async function readmeSummary(repo) {
  const data = await gh(`/repos/${USER}/${repo}/readme`);
  if (!data?.content) return "";
  const text = Buffer.from(data.content, "base64").toString("utf8");
  // First real prose line: skip headings, badges, quotes, code and boilerplate.
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^[#>!\[|`<-]/.test(l) && !/create react app|vite|template/i.test(l));
  return (line || "").replace(/\*\*/g, "").slice(0, 220);
}

const profile = await gh(`/users/${USER}`);
const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`)).filter(
  (r) => !r.fork && !r.archived && !r.private && r.name.toLowerCase() !== USER.toLowerCase()
);

const enriched = await Promise.all(
  repos.map(async (r) => {
    const [commits, languages, summary] = await Promise.all([
      commitCount(r.name),
      gh(`/repos/${USER}/${r.name}/languages`),
      r.description ? Promise.resolve(r.description) : readmeSummary(r.name),
    ]);
    const ageDays = (Date.now() - new Date(r.pushed_at)) / 864e5;
    // Ranking: real work (commits) + recognition (stars) + shipped (homepage) + freshness.
    const score =
      Math.log2(1 + commits) * 2 +
      r.stargazers_count * 3 +
      (r.homepage ? 2 : 0) +
      (summary ? 1 : 0) +
      Math.max(0, 3 - ageDays / 120);
    return {
      name: r.name,
      url: r.html_url,
      homepage: r.homepage ? (r.homepage.startsWith("http") ? r.homepage : `https://${r.homepage}`) : "",
      summary,
      stars: r.stargazers_count,
      commits,
      languages: Object.keys(languages || {}),
      languageBytes: languages || {},
      primaryLanguage: r.language,
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
      score: Number(score.toFixed(2)),
    };
  })
);

enriched.sort((a, b) => b.score - a.score);

// Totals across every public repo, for the numbers and stack sections.
// Script and config languages (batch files, PowerShell, MQL indicators) are left out of the stack.
const NOT_STACK = new Set(["Batchfile", "PowerShell", "Shell", "MQL4", "MQL5", "Procfile", "Dockerfile", "Makefile"]);
const bytes = {};
for (const r of enriched)
  for (const [lang, n] of Object.entries(r.languageBytes))
    if (!NOT_STACK.has(lang)) bytes[lang] = (bytes[lang] || 0) + n;
const totalBytes = Object.values(bytes).reduce((a, b) => a + b, 0);
const languages = Object.entries(bytes)
  .sort((a, b) => b[1] - a[1])
  .map(([name, n]) => ({ name, share: Number(((n / totalBytes) * 100).toFixed(1)) }))
  .filter((l) => l.share >= 0.5);

const totals = {
  repos: enriched.length,
  commits: enriched.reduce((a, r) => a + r.commits, 0),
  shipped: enriched.filter((r) => r.homepage).length,
  languages: languages.length,
  firstRepoAt: enriched.map((r) => r.createdAt).sort()[0],
};

// Every public repo by creation date, newest first, for the timeline.
const timeline = [...enriched]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  .map(({ name, url, homepage, summary, commits, createdAt, primaryLanguage }) => ({
    name, url, homepage, summary, commits, createdAt, primaryLanguage,
  }));

const out = {
  importedAt: new Date().toISOString(),
  profile: {
    login: profile.login,
    name: profile.name,
    bio: profile.bio,
    url: profile.html_url,
    avatar: profile.avatar_url,
    blog: profile.blog,
    publicRepos: profile.public_repos,
  },
  totals,
  languages,
  timeline,
  repos: enriched.slice(0, TOP_N).map(({ languageBytes, ...r }) => r),
};

writeFileSync(new URL("../src/data/github.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`Imported ${out.repos.length} of ${enriched.length} repos for ${USER}:`);
for (const r of out.repos) console.log(`  ${r.score.toString().padStart(5)}  ${r.name}  (${r.commits} commits)`);

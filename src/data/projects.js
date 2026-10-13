// Curated copy for the walkthrough. Live numbers (commits, languages, links) come from
// github.json, which `npm run import:github` regenerates. To feature a different repo,
// add an entry here keyed by its repo name; order here is the order along the path.
import github from "./github.json";

export const profile = {
  ...github.profile,
  // Fill these in to show them in the contact section and footer.
  email: "aditya.maini44@gmail.com",
  linkedin: "",
  resume: "", // e.g. "/resume.pdf" placed in public/
};

// Repos never shown anywhere on the site.
const HIDDEN = new Set(["ValorantComboChecker"]);

const FEATURED = [
  {
    repo: "doable",
    title: "Doable",
    line: "A planner that only shows you the next step once you finish this one.",
    body: "Built at the NYC CodeQuest Hackathon in 2026. You type a goal, an LLM breaks it into tasks, and you upload proof of each task to unlock the next. Finished tasks add pieces to a small 3D island.",
    stack: ["TypeScript", "LLM API", "Three.js"],
  },
  {
    repo: "Telegram-Management-System",
    title: "Telegram Alert System",
    line: "Real-time price alert and backtesting platform dispatching instant Telegram notifications.",
    body: "An alert platform and backtesting engine with multi-indicator rules, candle patterns, and multi-timeframe conditions. It evaluates market ticks with optimistic locking, deduplication, and cooldowns before dispatching messages via the Telegram Bot API through background workers.",
    stack: ["TypeScript", "Next.js 16", "PostgreSQL", "Prisma 7", "Telegram Bot API", "Redis / BullMQ"],
    fact: { value: "21", label: "technical indicators supported" },
    poster: {
      title: "Telegram-Management-System/README.md",
      lines: [
        ["# Levels — Telegram price alerts", "h"],
        ["", "p"],
        ["Real-time alert engine and backtester.", "p"],
        ["Instant Telegram delivery on triggered levels.", "p"],
        ["", "p"],
        ["Engine   Next.js 16, PostgreSQL, Prisma 7", "p"],
        ["Worker   Redis + BullMQ outbox queue", "p"],
        ["Bot API  Telegram webhook, dedupe, cooldown", "a"],
        ["Tests    Vitest unit & integration passing", "d"],
      ],
    },
  },
  {
    repo: "mishri-sweet-house",
    title: "Mishri Sweet House",
    line: "An online shop for a sweet shop in Jaipur.",
    body: "Written in plain HTML, CSS and JavaScript with no framework. It has a basket, UPI checkout, order tracking, and an admin page behind a password.",
    stack: ["HTML", "CSS", "JavaScript", "Vercel Middleware"],
    fact: { value: "0", label: "dependencies" },
  },
  {
    repo: "iphone-6-app",
    title: "Companion",
    line: "Turns an old iPhone 6 into a desk assistant.",
    body: "The phone runs the interface and a Python server on the PC does the chat, reminders and memory. Speech recognition stays on the phone. You pair them by scanning a QR code.",
    stack: ["Python", "FastAPI", "PWA", "Groq"],
    fact: { value: "1", label: "cloud service (Groq)" },
  },
  {
    repo: "ETI--main",
    title: "ETI Drone Visuals",
    line: "The website for a drone filming studio, and the admin behind it.",
    body: "Enquiries go to the studio's inbox and into an admin page where they track leads and change the footage on the site without a redeploy. The contact form is rate limited and stores IPs only as salted hashes.",
    stack: ["Next.js", "Supabase", "Resend", "Vercel Blob"],
  },
];

const byName = new Map(github.repos.map((r) => [r.name, r]));

export const projects = FEATURED.filter((p) => byName.has(p.repo)).map((p) => {
  const repo = byName.get(p.repo);
  return {
    ...p,
    url: repo.url,
    homepage: repo.homepage && !repo.homepage.includes("replit.com") ? repo.homepage : "",
    commits: repo.commits,
    languages: repo.languages,
    image: p.poster ? null : `/shots/${p.repo}.webp`,
    // Intrinsic size of the screenshot, so the fallback layout reserves its space.
    imageSize: p.repo === "iphone-6-app" ? [1040, 1960] : [1600, 1000],
  };
});

// Totals over the public repos the site shows (hidden repos are not counted).
const shown = github.timeline.filter((r) => !HIDDEN.has(r.name));
export const totals = {
  repos: shown.length,
  commits: shown.reduce((sum, r) => sum + r.commits, 0),
  live: shown.filter((r) => r.homepage && !r.homepage.includes("replit.com")).length,
  since: shown.map((r) => r.createdAt).sort()[0],
};
export const languages = github.languages;

// One honest line per repo for the git-log timeline. Repos with no line and no commits are skipped.
const TIMELINE_NOTES = {
  "Telegram-Management-System": "Levels: real-time Telegram price alerts and backtesting platform",
  "ETI--main": "Website and lead pipeline for ETI Drone Visuals",
  "mishri-sweet-house": "Storefront for a Jaipur mithai shop",
  "algo-trading": "GOLDM options engine, from backtests to broker adapters",
  "iphone-6-app": "Companion, a local AI desk assistant on an old iPhone",
  "Team-Axen-Round-2": "Team Axen hackathon, round two",
  doable: "Doable, built at the NYC CodeQuest Hackathon 2026",
  hack: "MemoryOS, an AI second brain for NYC CodeQuest 2026",
  "Proof-Craft": "Proof-Craft, an API server and web app workspace",
  "Aditya-Maini": "Portfolio v2 in Next.js 15",
  "pharma-ledger-nexus": "Pharmacy inventory manager in React, Express and TypeScript",
  "kotak-algo-frontend": "Algo trading dashboard on the Kotak API",
  "kotak-algo-backend": "Node backend for the Kotak algo dashboard",
  BackendProject: "Node backend practice project",
  "Web-Portfolio": "First portfolio site",
};

export const timeline = github.timeline
  .filter((r) => !HIDDEN.has(r.name) && r.commits > 0 && TIMELINE_NOTES[r.name])
  .map((r) => ({ ...r, note: TIMELINE_NOTES[r.name], featured: FEATURED.some((p) => p.repo === r.name) }));

// What the repos are built with, grouped. Every entry is used in at least one public repo.
export const toolbox = [
  { group: "Front end", items: ["React", "Next.js", "Three.js", "GSAP", "Tailwind CSS", "Vite"] },
  { group: "Back end", items: ["FastAPI", "Node.js", "Express", "Supabase", "PostgreSQL"] },
  { group: "AI", items: ["LLM APIs (OpenAI, Groq)", "ChromaDB vector search", "On-device speech"] },
  { group: "Shipping", items: ["Vercel", "Vercel Blob", "Resend", "PWA"] },
];

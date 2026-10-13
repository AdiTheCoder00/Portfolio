// Renders scripts/og.html to public/og.png (1200x630) with headless Chrome or Edge.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const browser = [
  process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("No Chrome or Edge found. Set BROWSER to a Chromium executable.");

const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
const page = pathToFileURL(fileURLToPath(new URL("./og.html", import.meta.url))).href;
execFileSync(browser, ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1", "--allow-file-access-from-files", "--virtual-time-budget=3000", "--window-size=1200,630", `--screenshot=${out}`, page], { stdio: "ignore" });
console.log("wrote public/og.png");

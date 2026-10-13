// The portfolio boot log, typed by the CRT renderer in place of ThreeUI's Zion log.
// Same shape as the original: 19 rows, phosphor text with dotted leaders into amber
// statuses, and no row longer than the original's longest (49 characters), so the
// glyphs render at the same size. Every number comes from the GitHub import.
import { profile, projects, totals, languages, timeline } from "../../data/projects.js";

type Tone = "p" | "d" | "a" | "h";
type Segment = { t: string; c: Tone };
const seg = (t: string, c: Tone = "p"): Segment => ({ t, c });

// Rows with a status end at the same column so the statuses line up.
const STATUS_COLUMN = 46;
const row = (label: string, status: string, statusTone: Tone = "a", labelTone: Tone = "p"): Segment[] => {
  const leader = Math.max(2, STATUS_COLUMN - label.length - status.length - 2);
  return [seg(`${label} `, labelTone), seg(`${"·".repeat(leader)} `, "d"), seg(status, statusTone)];
};

const year = new Date().getFullYear();
// The timeline is sorted newest first by creation date.
const newest = timeline[0];
const lead = languages[0];

const projectRows = projects.map((p: { title: string }, i: number) =>
  row(`proj${i}  ${p.title.toUpperCase()}`, "READY", "a", "d")
);

export const BOOT_LOG: Segment[][] = [
  [seg("ADITYA MAINI  v1.0"), seg(`   (c) ${year} ${profile.login}`, "d")],
  [seg(`GITHUB UPLINK  github.com/${profile.login}`, "d")],
  [],
  row(`Mounting /github/${profile.login}`, "OK"),
  row(`Indexing ${totals.commits} commits`, "OK"),
  row("Profiling languages", `${lead.name} ${Math.round(lead.share)}%`, "p"),
  ...projectRows,
  row("Laying out the 3D walkway", "OK"),
  row("Rendering screenshots", "OK"),
  row("Pinging live sites", `${totals.live} found`, "p"),
  [],
  [seg("Ready.", "h")],
  [seg(`Newest repo  ${newest.name}, created ${newest.createdAt.slice(0, 10)}`, "d")],
  [],
  [seg(`${profile.login.toLowerCase()}@github:~$ `)],
];

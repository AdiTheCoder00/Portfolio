import * as THREE from "three";

const SCREEN = "#06170e";
const BAR = "#0c2a1a";
const EDGE = "rgba(28,236,132,0.45)";
const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const TONES = {
  h: { fill: "#c9fbe0", glow: "rgba(120,255,190,0.85)" },
  p: { fill: "#8df0b4", glow: "rgba(28,236,132,0.6)" },
  d: { fill: "#4f9a76", glow: "rgba(28,236,132,0.3)" },
  a: { fill: "#ffba5e", glow: "rgba(255,150,52,0.8)" },
};

/**
 * A lit terminal window for projects with no UI to screenshot. It is drawn like the
 * CRT boot log (phosphor type with a soft halo) on a screen that is clearly brighter
 * than the night around it, so it reads as a monitor next to the screenshot panels.
 * `poster` is { title, lines: [[text, tone]] } where tone is h | p | d | a.
 */
export function createPosterTexture(poster, renderer) {
  const w = 1600;
  const h = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const lines = poster.lines ?? [[poster.title ?? "", "h"]];

  // Screen with a faint phosphor wash toward the centre.
  ctx.fillStyle = SCREEN;
  ctx.fillRect(0, 0, w, h);
  const wash = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.7);
  wash.addColorStop(0, "rgba(28,236,132,0.07)");
  wash.addColorStop(1, "rgba(28,236,132,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // Title bar.
  const barH = 84;
  ctx.fillStyle = BAR;
  ctx.fillRect(0, 0, w, barH);
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, barH, w, 2);
  ctx.font = `500 34px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#7cc49d";
  ctx.fillText(poster.title ?? "", 56, barH / 2 + 2);

  // Body text, sized so the longest line fits the screen width.
  const longest = Math.max(...lines.map(([t]) => t.length), 20);
  const size = Math.min(54, (w - 140) / (longest * 0.6));
  const lineH = size * 1.55;
  let y = barH + 70;
  ctx.textBaseline = "top";
  for (const [text, tone] of lines) {
    const t = TONES[tone] ?? TONES.p;
    ctx.font = `${tone === "h" ? 600 : 400} ${size.toFixed(1)}px ${MONO}`;
    // Halo pass, then a crisp pass on top, the same way the CRT draws its glyphs.
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = size * 0.45;
    ctx.fillStyle = t.fill;
    ctx.fillText(text, 70, y);
    ctx.shadowBlur = 0;
    ctx.fillText(text, 70, y);
    y += lineH;
  }

  // Block cursor after the last line.
  ctx.fillStyle = "#bdf8d2";
  ctx.shadowColor = TONES.p.glow;
  ctx.shadowBlur = size * 0.5;
  ctx.fillRect(70, y + size * 0.1, size * 0.58, size * 0.95);
  ctx.shadowBlur = 0;

  // Screen edge.
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.userData.aspect = w / h;
  return texture;
}

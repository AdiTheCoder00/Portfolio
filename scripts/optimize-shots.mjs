// Converts public/shots/*.png to WebP (quality 82, max 1600px wide) and removes the PNGs.
// capture-shots.mjs runs this automatically; run it by hand after dropping in new PNGs.
import sharp from "sharp";
import { readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/shots/", import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
  const src = dir + file;
  const out = src.replace(/\.png$/, ".webp");
  const info = await sharp(src).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  rmSync(src);
  console.log(`webp  ${file.replace(/\.png$/, ".webp")}  ${Math.round(info.size / 1024)} KB`);
}

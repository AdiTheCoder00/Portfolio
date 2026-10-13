import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (p) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The ThreeUI CRT source is vendored verbatim under src/shaders (from threeui.com/source-code/crt.json).
    alias: [
      { find: "@designcodeio/threeui/style.css", replacement: src("shaders/threeui.css") },
      { find: /^@designcodeio\/threeui$/, replacement: src("shaders/index.ts") },
    ],
  },
  // A build writes dist/index.html; without this the dev server sees it and reloads the page.
  server: { watch: { ignored: ["**/dist/**"] } },
  // three.js ships in its own lazily loaded chunk (src/three/world.js).
  build: { chunkSizeWarningLimit: 700 },
});

import { createRoot } from "react-dom/client";
import { Scene } from "./Scene";
import { BOOT_LOG_CHARS } from "./crt/crtRenderer";

/** Characters in the boot log; at 4.4 per 60Hz frame this sets how long typing takes. */
export const bootLogChars = BOOT_LOG_CHARS;

/**
 * Mounts the CRT boot screen into the loader and returns an unmount function.
 * The first dozen frames measure the display's refresh rate, then the typing pace is
 * normalised to 60Hz so the boot log takes the same time on every screen.
 */
export function mountBootScreen(host: HTMLElement) {
  const root = createRoot(host);
  root.render(<Scene />);

  // The boot can be skipped before sampling finishes; never touch the root after unmount.
  let mounted = true;
  let frame = 0;
  const stamps: number[] = [];
  const sample = (t: number) => {
    if (!mounted) return;
    stamps.push(t);
    if (stamps.length < 13) {
      frame = requestAnimationFrame(sample);
      return;
    }
    const gaps = stamps.slice(1).map((s, i) => s - stamps[i]).sort((a, b) => a - b);
    const hz = 1000 / gaps[Math.floor(gaps.length / 2)]; // median, so one slow frame does not skew it
    const pace = Math.min(4, Math.max(0.25, 60 / hz));
    root.render(<Scene typePace={pace} />);
  };
  frame = requestAnimationFrame(sample);

  return () => {
    mounted = false;
    cancelAnimationFrame(frame);
    root.unmount();
  };
}

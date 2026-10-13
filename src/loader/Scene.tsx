// The ThreeUI CRT, forked only to type the portfolio boot log (src/loader/crt). The original
// component stays untouched in src/shaders and is still exported as "@designcodeio/threeui".
import { CrtBackground } from "./crt/CrtBackground";
import "@designcodeio/threeui/style.css";

// `typePace` keeps the configured typeSpeed (1.00) at the pace it was authored for: the
// renderer types per animation frame, so on a 120Hz screen it would otherwise run twice
// as fast. mount.tsx measures the refresh rate and passes 60 / Hz.
export function Scene({ typePace = 1 }: { typePace?: number }) {
  return (
    <div className="shader-frame">
      <CrtBackground
        variant="terminal"
        speed={1.00}
        typeSpeed={1.00 * typePace}
        motion={1.00}
        hue={0}
        saturation={1.00}
        brightness={1.00}
        opacity={1.00}
      />
    </div>
  );
}

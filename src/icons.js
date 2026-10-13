// The six Phosphor icons the site uses, inlined from the official SVGs in @phosphor-icons/core
// (instead of the full icon font, which shipped ~1,500 glyphs for these six).
import arrowUp from "@phosphor-icons/core/assets/regular/arrow-up.svg?raw";
import arrowUpRight from "@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw";
import envelopeSimple from "@phosphor-icons/core/assets/regular/envelope-simple.svg?raw";
import fileText from "@phosphor-icons/core/assets/regular/file-text.svg?raw";
import githubLogo from "@phosphor-icons/core/assets/regular/github-logo.svg?raw";
import linkedinLogo from "@phosphor-icons/core/assets/regular/linkedin-logo.svg?raw";

const ICONS = {
  "arrow-up": arrowUp,
  "arrow-up-right": arrowUpRight,
  "envelope-simple": envelopeSimple,
  "file-text": fileText,
  "github-logo": githubLogo,
  "linkedin-logo": linkedinLogo,
};

/** Decorative icon markup; the text next to it carries the meaning. */
export const icon = (name) =>
  (ICONS[name] ?? "").replace("<svg ", '<svg class="icon" aria-hidden="true" focusable="false" ');

/** Swaps `<i data-icon="name">` placeholders in static markup for the inline SVG. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("i[data-icon]")) el.outerHTML = icon(el.dataset.icon);
}

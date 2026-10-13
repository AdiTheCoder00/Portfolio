import "@fontsource-variable/geist-mono";
import "lenis/dist/lenis.css";
import "./style.css";

import { projects, profile, totals, languages, timeline, toolbox } from "./data/projects.js";
import { icon, hydrateIcons } from "./icons.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Content from data ----------

function renderProjects() {
  const html = projects
    .map((p, i) => {
      // Panels alternate right, left, right... so the copy takes the other side.
      const side = i % 2 === 0 ? "left" : "right";
      const live = p.homepage
        ? `<a class="btn btn-primary" href="${esc(p.homepage)}" target="_blank" rel="noopener">Visit site ${icon("arrow-up-right")}</a>`
        : "";
      // The 3D walk draws these as panels; the fallback layout shows them as plain content.
      const shot = p.image
        ? `<img class="shot" src="${esc(p.image)}" alt="${esc(p.title)} home screen" width="${p.imageSize[0]}" height="${p.imageSize[1]}" loading="lazy" decoding="async" />`
        : p.poster
          ? `<pre class="shot shot-term" aria-label="${esc(p.poster.title)}"><span class="term-title">${esc(p.poster.title)}</span>${p.poster.lines
              .map(([text, tone]) => `<span class="t-${tone}">${esc(text)}</span>`)
              .join("\n")}</pre>`
          : "";
      return `
      <article class="stop project" id="${esc(p.repo)}" data-stop="${i + 1}" data-side="${side}" aria-labelledby="${esc(p.repo)}-title">
        <div class="stop-inner">
          <div class="copy">
            <h2 id="${esc(p.repo)}-title">${esc(p.title)}</h2>
            <p class="lead">${esc(p.line)}</p>
            <p class="body-copy">${esc(p.body)}</p>
            ${p.fact ? `<dl class="facts"><div class="stat"><dt>${esc(p.fact.label)}</dt><dd>${esc(p.fact.value)}</dd></div></dl>` : ""}
            <ul class="chips" aria-label="Built with">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
            <div class="ctas">
              ${live}
              <a class="btn btn-ghost" href="${esc(p.url)}" target="_blank" rel="noopener">${icon("github-logo")} Source</a>
            </div>
          </div>
          ${shot}
        </div>
      </article>`;
    })
    .join("");
  $("#overview").insertAdjacentHTML("beforebegin", html);
}

const monthYear = (iso) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const ymd = (iso) => iso.slice(0, 10);

function renderAfter() {
  // One plain sentence of GitHub numbers, live from the import.
  $("#about-numbers").textContent =
    `Since ${monthYear(totals.since)} I have put ${totals.repos} repos on GitHub, ${totals.live} of them with a live site.`;

  // Languages by share of code, then the grouped toolbox.
  $("#langs").innerHTML = languages
    .map((l) => `<li><span class="lang">${esc(l.name)}</span><span class="share">${l.share}%</span></li>`)
    .join("");
  $("#toolbox").innerHTML = toolbox
    .map(
      (g) => `<div class="tool-group"><h3>${esc(g.group)}</h3><ul class="chips">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`
    )
    .join("");

  // git log: every shown public repo, newest first.
  $("#log-sub").textContent = `${timeline.length} repos, newest first. The ones from the walk are marked.`;
  $("#log-list").innerHTML = timeline
    .map((r) => {
      const name = `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>`;
      const tag = r.featured ? `<span class="tag">on the path</span>` : "";
      return `<li${r.featured ? ' class="is-featured"' : ""}>
        <time datetime="${esc(ymd(r.createdAt))}">${esc(ymd(r.createdAt))}</time>
        <span class="repo">${name}</span>
        <span class="note">${esc(r.note)} ${tag}</span>
        <span class="count">${r.commits} commits</span>
      </li>`;
    })
    .join("");

  // Channels and footer links: only what is filled in.
  const channels = [
    profile.email && { icon: "envelope-simple", label: profile.email, href: `mailto:${profile.email}` },
    { icon: "github-logo", label: `github.com/${profile.login}`, href: profile.url },
    profile.linkedin && { icon: "linkedin-logo", label: "LinkedIn", href: profile.linkedin },
    profile.resume && { icon: "file-text", label: "Resume (PDF)", href: profile.resume },
  ].filter(Boolean);
  $("#channels").innerHTML = channels
    .map((c) => {
      const ext = c.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<li><a href="${esc(c.href)}"${ext}>${icon(c.icon)} ${esc(c.label)}</a></li>`;
    })
    .join("");
  $("#foot-links").innerHTML = channels
    .filter((c) => c.icon !== "file-text")
    .map((c) => {
      const ext = c.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<li><a href="${esc(c.href)}"${ext}>${esc(c.icon === "envelope-simple" ? "Email" : c.icon === "github-logo" ? "GitHub" : "LinkedIn")}</a></li>`;
    })
    .join("");
  $("#year").textContent = new Date().getFullYear();

  setupContactForm();
}

/** After a jump to a section, move keyboard focus there too (without scrolling again). */
function focusSection(el) {
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

/**
 * The git log prints line by line the first time it scrolls into view, the way terminal
 * output arrives. Rows stay visible unless this runs, and reduced motion skips it in CSS.
 */
function armLogPrint() {
  const list = $("#log-list");
  if (!list || !("IntersectionObserver" in window)) return;
  [...list.children].forEach((li, i) => li.style.setProperty("--i", Math.min(i, 16)));
  list.classList.add("is-armed");
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      list.classList.add("is-printed");
      io.disconnect();
    },
    { threshold: 0.15 }
  );
  io.observe(list);
}

// The form posts to VITE_FORM_ENDPOINT (e.g. a Formspree URL) when set, otherwise opens a
// prefilled email to profile.email. With neither configured, only the channels are shown.
function setupContactForm() {
  const form = $("#mail-form");
  const endpoint = import.meta.env.VITE_FORM_ENDPOINT;
  if (!endpoint && !profile.email) {
    form.remove();
    $(".contact-grid").classList.add("no-form");
    $("#contact .lead").textContent = "For now the best way to reach me is through GitHub.";
    return;
  }
  const status = $("#form-status");
  const submit = $("#f-submit");
  const emailError = $("#f-email-error");

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "");
    emailError.hidden = emailOk;
    $("#f-email").setAttribute("aria-invalid", String(!emailOk));
    if (!data.name || !data.message || !emailOk) {
      status.textContent = "Fill in your name, email and a message.";
      status.dataset.state = "error";
      return;
    }

    if (!endpoint) {
      const subject = encodeURIComponent(`Hello from ${data.name}`);
      const body = encodeURIComponent(`${data.message}\n\n${data.name} (${data.email})`);
      window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
      status.textContent = "Your email app should open with the message ready to send.";
      status.dataset.state = "ok";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Sending...";
    status.textContent = "";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = "Sent. I will reply to the address you gave.";
      status.dataset.state = "ok";
    } catch {
      status.textContent = "That did not go through. Try again, or use one of the links.";
      status.dataset.state = "error";
    } finally {
      submit.disabled = false;
      submit.textContent = "Send message";
    }
  });
}

renderProjects();
renderAfter();
hydrateIcons();
armLogPrint();

// ---------- Mode ----------

// Scroll restoration is handled here rather than by the browser: the page is far taller
// once the walk is laid out, so the browser's own restore lands in the wrong place.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// sessionStorage can throw (privacy modes, blocked storage); treat that as "nothing saved".
const session = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  },
};

// The CRT boot plays on every page load. A reload then returns to where the visitor was.
const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
const savedY = isReload ? Number(session.get("scrollY")) || 0 : 0;
window.addEventListener("pagehide", () => session.set("scrollY", String(Math.round(window.scrollY))));
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// ---------- Boot screen (ThreeUI CRT terminal) ----------

// The boot log is typed at 4.4 characters per frame at 60Hz (mount.tsx keeps that pace on
// any refresh rate), so typing takes bootLogChars / 4.4 / 60 seconds. Then hold a beat on
// the blinking prompt, and never keep a visitor longer than BOOT_MAX_MS.
const typeMs = (chars) => Math.ceil((chars / 4.4 / 60) * 1000);
const BOOT_HOLD_MS = 650;
const BOOT_MAX_MS = 7000;
const POWER_OFF_MS = 620;
const QUICK_FADE_MS = 350;

const boot = (() => {
  const loader = $("#loader");
  const skipButton = $("#loader-skip");
  const startedAt = performance.now();
  let unmount = null;
  let skip;
  const skipped = new Promise((resolve) => (skip = resolve));
  const onKey = (ev) => {
    if (ev.key === "Escape" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      skip();
    }
  };

  let typed;
  const typedOut = new Promise((resolve) => (typed = resolve));
  const playBoot = !reduceMotion;
  if (!playBoot) loader.classList.add("is-quick");

  if (playBoot) {
    import("./loader/mount.tsx")
      .then((m) => {
        unmount = m.mountBootScreen($("#boot"));
        setTimeout(typed, typeMs(m.bootLogChars));
      })
      .catch((err) => {
        console.error(err);
        typed();
      });
    setTimeout(() => skipButton.classList.add("is-shown"), 700);
    skipButton.addEventListener("click", skip);
    loader.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);
    // Trying to scroll during the boot log means "let me in": skip to the site.
    window.addEventListener("wheel", skip, { once: true, passive: true });
    window.addEventListener("touchmove", skip, { once: true, passive: true });
    // Dev only: ?p= (frame checks) skips straight past the boot log.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("p")) skip();
  }

  /** Resolves once the site is ready and the boot log has had its moment (or was skipped). */
  async function end(ready) {
    if (!playBoot) {
      // Reduced motion: no boot log, just a short fade once the site is ready.
      await ready;
      loader.classList.add("is-faded");
      await wait(reduceMotion ? 0 : QUICK_FADE_MS);
      loader.classList.add("is-done");
      return;
    }
    const bootDone = typedOut.then(() => wait(BOOT_HOLD_MS));
    const ceiling = wait(BOOT_MAX_MS - (performance.now() - startedAt));
    await Promise.all([ready, Promise.race([bootDone, ceiling, skipped])]);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", skip);
    window.removeEventListener("touchmove", skip);
    $("#loader-status").textContent = "Loaded";
    loader.classList.add("is-off");
    await wait(POWER_OFF_MS);
    loader.classList.add("is-done");
    unmount?.();
  }
  // Resolves when the log has finished typing (or immediately with no boot screen), so
  // heavy GPU uploads can wait for the hold on the prompt instead of stalling the typing.
  const typedDone = playBoot ? Promise.race([typedOut, skipped]) : Promise.resolve();
  return { end, typedDone };
})();

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

async function startStatic() {
  document.body.classList.add("is-static");
  // Smooth Lenis scrolling here too, except for visitors who asked for reduced motion.
  let lenis = null;
  if (!reduceMotion) {
    const { default: Lenis } = await import("lenis");
    lenis = new Lenis({ lerp: 0.1, autoRaf: true });
  }
  if (savedY && !location.hash) window.scrollTo(0, savedY);
  boot.end(Promise.resolve());
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-goto]");
    if (!link) return;
    ev.preventDefault();
    const goto = link.dataset.goto;
    const target = /^\d+$/.test(goto) || goto === "end" ? document.querySelector(`[data-stop="${goto}"]`) : document.getElementById(goto);
    if (!target) return;
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ block: "start" });
    focusSection(target);
  });
}

async function start3D() {
  const [{ World }, { gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
    import("./three/world.js"),
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("lenis"),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.add("is-3d");

  const world = new World($("#scene"), projects);
  if (import.meta.env.DEV) window.__world = world; // dev-only handle for inspecting the path
  const segs = world.segments;
  const track = $("#track");
  track.style.height = `calc(${segs} * 90svh + 100svh)`;

  await world.load(() => {});

  // Each overlay is tied to the stop index where the camera holds still.
  const overlays = [...document.querySelectorAll(".stop")].map((el) => {
    const s = el.dataset.stop;
    return { el, idx: s === "end" ? segs : world.stopIndex(Number(s)), opacity: -1 };
  });

  const rail = $("#rail");
  rail.innerHTML = projects
    .map((p, i) => `<li data-idx="${world.stopIndex(i + 1)}"><button type="button" data-goto="${i + 1}" aria-label="${p.title}"><span class="label">${p.title}</span></button></li>`)
    .join("");
  const railItems = [...rail.children];
  rail.insertAdjacentHTML("beforeend", `<li class="rail-hint" aria-hidden="true"><kbd>j</kbd> <kbd>k</kbd> next / previous</li>`);
  const progressFill = $("#progress-fill");

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.1, touchMultiplier: 1.4 });
  lenis.stop(); // no walking while the tube is still booting
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const trigger = ScrollTrigger.create({ trigger: track, start: "top top", end: "bottom bottom" });
  // How far the sections after the walk have come up over the scene (0..1).
  const afterTrigger = ScrollTrigger.create({ trigger: ".after", start: "top bottom", end: "top 35%" });
  const canvas = $("#scene");

  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-goto]");
    if (!link) return;
    ev.preventDefault();
    const goto = link.dataset.goto;
    let y;
    if (/^\d+$/.test(goto) || goto === "end") {
      // A stop on the walk: scroll to where the camera holds for it.
      const idx = goto === "end" ? segs : world.stopIndex(Number(goto));
      y = trigger.start + (idx / segs) * (trigger.end - trigger.start);
    } else {
      // A section after the walk.
      const el = document.getElementById(goto);
      if (!el) return;
      y = el.getBoundingClientRect().top + window.scrollY;
      focusSection(el);
    }
    const distance = Math.abs(y - window.scrollY) / window.innerHeight;
    lenis.scrollTo(y, { duration: Math.min(1.2 + distance * 0.25, 4) });
  });

  // j / k step to the next / previous stop on the walk, like moving through a pager.
  const stopIdx = [0, ...projects.map((_, i) => world.stopIndex(i + 1)), segs];
  window.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return;
    if (ev.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const key = ev.key.toLowerCase();
    if (key !== "j" && key !== "k") return;
    if (afterTrigger.progress > 0.3) return; // past the walk, the keys do nothing
    const { x } = world.locate(trigger.progress);
    const next = key === "j" ? stopIdx.find((i) => i > x + 0.05) : [...stopIdx].reverse().find((i) => i < x - 0.05);
    if (next === undefined) return;
    ev.preventDefault();
    const y = trigger.start + (next / segs) * (trigger.end - trigger.start);
    lenis.scrollTo(y, { duration: 1.1 + Math.abs(next - x) * 0.25 });
  });

  window.addEventListener("pointermove", (ev) => {
    world.setPointer((ev.clientX / window.innerWidth) * 2 - 1, -((ev.clientY / window.innerHeight) * 2 - 1));
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      world.resize();
      ScrollTrigger.refresh();
    }, 120);
  });

  const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // The page text only depends on scroll position, so it is restyled only when that moves.
  let lastP = -1;
  let lastAfter = -1;

  function frame() {
    const p = trigger.progress;
    world.update(p); // still runs while idle: the pointer parallax eases toward the cursor
    world.render(); // draws only if something visible changed

    const after = afterTrigger.progress;
    if (p === lastP && after === lastAfter) return;
    lastP = p;
    lastAfter = after;

    const { x, j } = world.locate(p);
    canvas.style.opacity = (1 - after * 0.72).toFixed(3);
    rail.classList.toggle("is-away", after > 0.3);
    for (const o of overlays) {
      const d = x - o.idx;
      const opacity = (1 - smoothstep(0.24, 0.44, Math.abs(d))) * (1 - after);
      if (Math.abs(opacity - o.opacity) < 0.001) continue;
      o.opacity = opacity;
      o.el.style.opacity = opacity.toFixed(3);
      o.el.style.transform = `translate3d(0, ${(-d * 70).toFixed(1)}px, 0)`;
      const on = opacity > 0.02;
      o.el.classList.toggle("is-on", on);
      o.el.inert = opacity < 0.6;
    }
    railItems.forEach((li) => {
      const idx = Number(li.dataset.idx);
      li.classList.toggle("is-built", j >= idx - 0.02);
      li.classList.toggle("is-active", Math.abs(x - idx) < 0.5);
    });
    progressFill.style.transform = `scaleX(${p.toFixed(4)})`;
  }
  gsap.ticker.add(frame);

  // Land on a stop if the page was opened with a hash (e.g. #contact).
  const hashTarget = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (hashTarget?.dataset.stop) {
    const idx = hashTarget.dataset.stop === "end" ? segs : world.stopIndex(Number(hashTarget.dataset.stop));
    lenis.scrollTo(trigger.start + (idx / segs) * (trigger.end - trigger.start), { immediate: true, force: true });
  }
  // Dev only: ?p=0.4 opens the walk at that progress, for checking frames.
  const debugP = import.meta.env.DEV && new URLSearchParams(location.search).get("p");
  if (debugP) lenis.scrollTo(trigger.start + Number(debugP) * (trigger.end - trigger.start), { immediate: true, force: true });
  // A reload returns to where the visitor was (a #hash link takes precedence).
  else if (savedY && !hashTarget) {
    ScrollTrigger.refresh();
    lenis.scrollTo(savedY, { immediate: true, force: true });
  }

  // Upload textures and compile shaders during the hold on the prompt, not mid-typing.
  await boot.typedDone;
  world.warmup();
  frame();
  await boot.end(Promise.resolve());
  lenis.start();
  gsap.from(".hero .stop-inner > *", {
    y: 28,
    opacity: 0,
    duration: 1.2,
    stagger: 0.09,
    ease: "expo.out",
  });
}

// Dev only: ?static previews the no-WebGL fallback layout.
const forceStatic = import.meta.env.DEV && new URLSearchParams(location.search).has("static");
if (forceStatic || reduceMotion || !webglAvailable()) {
  startStatic();
} else {
  start3D().catch((err) => {
    console.error(err);
    document.body.classList.remove("is-3d");
    startStatic();
  });
}

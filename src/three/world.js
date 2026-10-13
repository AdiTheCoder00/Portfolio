import * as THREE from "three";
import { createPanelMaterial, createFloorMaterial, createDustMaterial } from "./materials.js";
import { createPosterTexture } from "./poster.js";

// Palette from the ThreeUI CRT terminal: amber for what is built, phosphor green for the rest.
export const ACCENT = "#ffba5e";
const PHOSPHOR = "#1cec84";
const FOG = "#03100a";
const FOG_DENSITY = 0.034;
const PANEL_FOG_DENSITY = 0.018;
const FOV = 42;
const GAP = 13; // walking room between one panel and the next camera stop
const HOLD = 0.22; // fraction of a segment the camera eases through at each stop
const CREEP = 0.14; // share of linear motion kept at stops, so every wheel tick moves the camera

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The walkthrough scene. Scroll progress p (0..1) maps onto a camera path that stops
 * in front of each project panel. Panels build themselves from a blueprint as the camera
 * arrives, and a route line on the floor fills in behind the camera. At the end the
 * camera rises and looks back over the finished route.
 */
export class World {
  constructor(canvas, projects) {
    this.projects = projects;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    // Pixel ratio is set per size in resize(), against a pixel budget.
    this.dirty = true; // render only when something visible changed (see update/render)
    this.lastView = new Float32Array(7);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(FOG);
    this.scene.fog = new THREE.FogExp2(FOG, FOG_DENSITY);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 260);
    this.stations = [];
    this.pointer = new THREE.Vector2();
    this.pointerEased = new THREE.Vector2();
    this.timer = new THREE.Timer();
    this.lookTarget = new THREE.Vector3();
    this.finePointer = window.matchMedia("(pointer: fine)").matches;
    // If the GPU resets (driver update, sleep, too many tabs), three.js rebuilds its state on
    // restore; the scene just needs one fresh frame instead of staying blank until a scroll.
    canvas.addEventListener("webglcontextrestored", () => (this.dirty = true));
  }

  /**
   * Path points: start, then each project with a pass-through waypoint between
   * neighbours (so the camera walks around a panel instead of through it), then a
   * pass-through rise and the final overview.
   */
  get segments() {
    return 2 * this.projects.length + 1;
  }

  /** Path index where the camera holds for stop n (0 = hero, 1..N = projects, N+1 = end). */
  stopIndex(n) {
    if (n <= 0) return 0;
    if (n > this.projects.length) return this.segments;
    return 2 * n - 1;
  }

  async load(onProgress) {
    // ImageBitmapLoader decodes the screenshots off the main thread, so the boot log keeps typing.
    const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY" });
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    await Promise.all([
      document.fonts.load('600 100px "Geist Mono Variable"'),
      document.fonts.load('400 40px "Geist Mono Variable"'),
    ]).catch(() => {});

    let done = 0;
    const textures = await Promise.all(
      this.projects.map(async (p) => {
        let tex = null;
        if (p.image) {
          try {
            const bitmap = await loader.loadAsync(p.image);
            tex = new THREE.Texture(bitmap);
            tex.flipY = false; // already flipped during decode
            tex.needsUpdate = true;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = maxAniso;
            tex.userData.aspect = bitmap.width / bitmap.height;
          } catch {
            tex = null;
          }
        }
        if (!tex) {
          const poster = p.poster ?? {
            title: `${p.repo}/README.md`,
            lines: [[`# ${p.title}`, "h"], ["", "p"], [p.line, "p"], ["", "p"], [`${p.commits} commits`, "a"]],
          };
          tex = createPosterTexture(poster, this.renderer);
        }
        onProgress(++done / this.projects.length);
        return tex;
      })
    );

    this.build(textures);
    this.resize();
  }

  build(textures) {
    const n = this.projects.length;
    const pathLength = 16 + n * 30; // rough length of the walk; the floor and dust only need to cover it

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      createFloorMaterial({ fogColor: FOG, fogDensity: FOG_DENSITY })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -pathLength / 2;
    this.floor = floor;
    this.scene.add(floor);

    // Dust in the air gives the fog depth while the camera moves.
    const count = this.finePointer ? 1600 : 700;
    const positions = new Float32Array(count * 3);
    let pIdx = 0;
    let attempts = 0;
    const maxAttempts = count * 10;
    while (pIdx < count && attempts < maxAttempts) {
      attempts++;
      const x = (Math.random() - 0.5) * 40;
      const y = Math.random() * 12;
      const z = 14 - Math.random() * (pathLength + 40);
      // Keep clear of the central eye-level walkway and station panel sightlines so dust never
      // blocks project titles, screenshots, or camera stops.
      if (Math.abs(x) < 3.8 && y > 0.8 && y < 3.2 && z < 10) {
        continue;
      }
      positions[pIdx * 3] = x;
      positions[pIdx * 3 + 1] = y;
      positions[pIdx * 3 + 2] = z;
      pIdx++;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, pIdx * 3), 3));
    this.dustMaterial = createDustMaterial({ color: "#4f9a76", size: 0.04, opacity: 0.5 });
    this.dust = new THREE.Points(dustGeo, this.dustMaterial);
    this.scene.add(this.dust);

    const legMaterial = new THREE.MeshBasicMaterial({ color: "#123824" });

    textures.forEach((tex, i) => {
      const imageAspect = tex.userData.aspect;
      let w, h;
      if (imageAspect < 1) {
        h = 4.2;
        w = h * imageAspect;
      } else {
        w = 5.2;
        h = Math.min(w / imageAspect, 3.4);
      }

      const material = createPanelMaterial({
        map: tex,
        imageAspect,
        panelAspect: w / h,
        accent: ACCENT,
        grid: PHOSPHOR,
        fogColor: FOG,
        fogDensity: PANEL_FOG_DENSITY,
      });
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      group.add(mesh);

      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.16, h + 0.16)),
        new THREE.LineBasicMaterial({ color: PHOSPHOR, transparent: true, opacity: 0.35 })
      );
      frame.position.z = -0.01;
      group.add(frame);

      const legHeight = 0.7;
      for (const x of [-w * 0.32, w * 0.32]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, legHeight, 0.03), legMaterial);
        leg.position.set(x, -h / 2 - legHeight / 2, -0.02);
        group.add(leg);
      }

      this.scene.add(group);
      this.stations.push({ group, mesh, material, frame, w, h, legHeight });
    });
  }

  /** Recomputes the panel poses and camera path for the current viewport. */
  layout() {
    const { width, height } = this.size;
    const aspect = width / height;
    const mobile = aspect < 0.85;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fracW = mobile ? 0.86 : 0.4;
    const fracH = mobile ? 0.42 : 0.6;

    const points = [new THREE.Vector3(0, 1.8, 9)];
    const looks = [new THREE.Vector3(0, 1.4, -40)];
    const stops = [true];

    const visibleW = (d) => 2 * d * tanHalf * aspect;
    // How far the camera stands from each panel to frame it; stations are spaced by this so
    // the walk between two panels always has room for an easy sideways sweep.
    const dists = this.stations.map((st) =>
      Math.max(st.w / (fracW * 2 * tanHalf * aspect), st.h / (fracH * 2 * tanHalf), 4.5)
    );
    let z = -16;

    this.stations.forEach((st, i) => {
      const side = i % 2 === 0 ? 1 : -1; // panel on the right first, then alternate
      const theta = -side * 0.2; // turn each panel slightly toward the walkway
      const normal = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
      const d = dists[i];
      if (i > 0) z -= d + GAP;

      const center = new THREE.Vector3(side * 2.2, st.legHeight + st.h / 2, z);
      st.group.position.copy(center);
      st.group.rotation.y = theta;
      st.side = side;

      const lateral = mobile ? 0 : 0.21 * visibleW(d); // panel spans ~51-91% of the width, left of the rail
      const cam = center
        .clone()
        .addScaledVector(normal, d)
        .addScaledVector(right, -side * lateral);
      cam.y = mobile ? center.y : center.y - 0.25;
      points.push(cam);
      looks.push(cam.clone().addScaledVector(normal, -20));
      stops.push(true);

      // Pass level with this panel, clear of its inner edge, before sweeping to the next one.
      if (i < this.stations.length - 1) {
        const innerEdge = center.x - side * (st.w / 2) * Math.cos(theta);
        const waypoint = new THREE.Vector3(innerEdge - side * 1.4, 1.9, center.z - 1);
        points.push(waypoint);
        looks.push(waypoint.clone().add(new THREE.Vector3(-side * 3, 0, -24)));
        stops.push(false);
      }
    });

    const last = this.stations.at(-1).group.position;
    const midZ = (this.stations[0].group.position.z + last.z) / 2;

    // Pull back and up off the last panel, then fly back over the route to look down it.
    points.push(new THREE.Vector3(0, 9, last.z + 14));
    looks.push(new THREE.Vector3(0, 1, last.z - 6));
    stops.push(false);

    // Final overview: high behind the start, looking down the whole lit route.
    // On wide screens aim left of the route so it fills the right half beside the copy.
    points.push(new THREE.Vector3(0, 15, 20));
    looks.push(new THREE.Vector3(mobile ? 0 : -15, mobile ? -8 : -3, midZ - 10));
    stops.push(true);

    this.path = new THREE.CatmullRomCurve3(points, false, "centripetal");
    this.points = points;
    this.looks = looks;
    this.stops = stops;

    this.buildRoute();
  }

  /**
   * The route on the floor follows the camera's own walk, smoothed into one flowing line.
   * It is sampled densely from the camera path, the sideways wobble is blurred out, and the
   * arc length at each sample is kept so the lit part can track the camera exactly.
   */
  buildRoute() {
    if (this.route) {
      this.scene.remove(this.route.built, this.route.planned);
      this.route.built.geometry.dispose();
      this.route.planned.geometry.dispose();
    }
    const segs = this.points.length - 1;
    const jMax = this.stopIndex(this.stations.length);
    const K = 480;
    const pts = [];
    for (let k = 0; k <= K; k++) {
      const p = this.path.getPoint(((k / K) * jMax) / segs);
      pts.push(new THREE.Vector3(p.x, 0.02, p.z));
    }
    // Three box-blur passes on x: a soft S instead of the camera's side steps.
    for (let pass = 0; pass < 3; pass++) {
      const xs = pts.map((p) => p.x);
      const r = 14;
      for (let k = 1; k < K; k++) {
        let sum = 0;
        let n = 0;
        for (let o = -r; o <= r; o++) {
          const q = Math.min(K, Math.max(0, k + o));
          sum += xs[q];
          n++;
        }
        pts[k].x = sum / n;
      }
    }
    const lengths = [0];
    for (let k = 1; k <= K; k++) lengths.push(lengths[k - 1] + pts[k].distanceTo(pts[k - 1]));
    const total = lengths[K];
    this.routeArc = (j) => {
      const f = Math.min(1, Math.max(0, j / jMax)) * K;
      const k = Math.min(K - 1, Math.floor(f));
      return (lengths[k] + (lengths[k + 1] - lengths[k]) * (f - k)) / total;
    };

    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const tubular = 900;
    const radial = 6;
    const geometry = new THREE.TubeGeometry(curve, tubular, 0.028, radial, false);

    const planned = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: "#0f3a25" }));
    const built = new THREE.Mesh(geometry.clone(), new THREE.MeshBasicMaterial({ color: ACCENT }));
    built.position.y = 0.002;
    built.geometry.setDrawRange(0, 0);
    this.scene.add(planned, built);
    this.route = { built, planned, tubular, radial };
  }

  resize() {
    // A hidden or not-yet-laid-out window can report 0x0; keep the math finite.
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    this.size = { width, height };
    // Cap the drawing buffer at ~3.2M pixels: a 1.75x retina 1512x982 stays sharp, while a large
    // monitor no longer renders 7M+ pixels every frame. Never drop below 0.75 of CSS pixels.
    const budget = Math.sqrt(3.2e6 / (width * height));
    this.renderer.setPixelRatio(Math.max(0.75, Math.min(window.devicePixelRatio, 1.75, budget)));
    this.renderer.setSize(width, height, false);
    this.dirty = true;
    this.camera.aspect = width / height;
    // On portrait screens the copy sits at the bottom, so shift the scene up the frame.
    if (width / height < 0.85) this.camera.setViewOffset(width, height, 0, height * 0.17, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (this.dustMaterial) {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      this.dustMaterial.uniforms.uScale.value = height / (2.0 * tanHalf);
    }
    if (this.stations.length) this.layout();
  }

  /**
   * Splits scroll progress into a segment index and an eased position within it.
   * Returns x (raw position in stop units) and j (eased position the camera is at).
   */
  locate(p) {
    const segs = this.points.length - 1;
    const x = clamp01(p) * segs;
    const k = Math.min(Math.floor(x), segs - 1);
    const l = x - k;
    const holdStart = this.stops[k];
    const holdEnd = this.stops[k + 1];
    const t = clamp01((l - (holdStart ? HOLD : 0)) / (1 - (holdStart ? HOLD : 0) - (holdEnd ? HOLD : 0)));
    let e;
    if (holdStart && holdEnd) e = smootherstep(t);
    else if (holdStart) e = t * t;
    else if (holdEnd) e = 1 - (1 - t) * (1 - t);
    else e = t;
    // Never fully stop: blend in a little linear motion so the scene answers every scroll.
    e = THREE.MathUtils.lerp(e, l, CREEP);
    return { x, k, e, j: k + e };
  }

  update(p) {
    if (!this.path) return;
    const { k, e, j } = this.locate(p);
    const segs = this.points.length - 1;

    this.path.getPoint(j / segs, this.camera.position);
    this.lookTarget.lerpVectors(this.looks[k], this.looks[k + 1], e);

    if (this.finePointer) {
      this.pointerEased.lerp(this.pointer, 0.05);
      this.camera.position.x += this.pointerEased.x * 0.3;
      this.camera.position.y += this.pointerEased.y * 0.16;
    }
    this.camera.lookAt(this.lookTarget);

    // Anything visible moved? Camera position or aim (pointer parallax eases in, so this
    // settles to "no" a moment after the pointer stops).
    const view = this.lastView;
    const now = [
      this.camera.position.x, this.camera.position.y, this.camera.position.z,
      this.lookTarget.x, this.lookTarget.y, this.lookTarget.z, j,
    ];
    for (let i = 0; i < 7; i++) {
      if (Math.abs(now[i] - view[i]) > 1e-4) this.dirty = true;
      view[i] = now[i];
    }

    // Panels build as the camera travels the segment that arrives at them.
    this.stations.forEach((st, i) => {
      const arrive = this.stopIndex(i + 1) - 1; // the segment that ends at this station
      const reveal = k > arrive ? 1 : k < arrive ? 0 : smoothstep(0.25, 0.95, e);
      // A panel mid-build animates its noisy build edge, so it needs every frame.
      if (reveal > 0 && reveal < 1) this.dirty = true;
      st.material.uniforms.uReveal.value = reveal;
      st.frame.material.opacity = 0.35 - reveal * 0.22;
    });

    // Route fills in up to where the camera is.
    const routeFrac = this.routeArc(j);
    const { built, tubular, radial } = this.route;
    built.geometry.setDrawRange(0, Math.floor(routeFrac * tubular) * radial * 6);

    // Clear the fog for the final overview.
    const outro = smoothstep(segs - 2, segs, j);
    const density = THREE.MathUtils.lerp(FOG_DENSITY, 0.011, outro);
    this.scene.fog.density = density;
    this.floor.material.uniforms.uFogDensity.value = density;
    const panelFog = THREE.MathUtils.lerp(PANEL_FOG_DENSITY, 0.006, outro);
    for (const st of this.stations) st.material.uniforms.uFogDensity.value = panelFog;
  }

  /** Uploads every texture and compiles every material now, so the first frames do not hitch. */
  warmup() {
    for (const st of this.stations) this.renderer.initTexture(st.material.uniforms.uMap.value);
    this.renderer.compile(this.scene, this.camera);
    this.dirty = true;
  }

  /**
   * Draws a frame only if update() saw a change. A visitor reading a stop costs no GPU time,
   * where the scene used to redraw at the full refresh rate (145 times a second) while idle.
   */
  render() {
    this.timer.update();
    if (!this.dirty) return false;
    const t = this.timer.getElapsed();
    for (const st of this.stations) st.material.uniforms.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    return true;
  }

  setPointer(nx, ny) {
    this.pointer.set(nx, ny);
  }
}

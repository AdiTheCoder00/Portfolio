import * as THREE from "three";

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const FOG_VERT = /* glsl */ `
  varying float vDepth;
`;

// A project screen that is drawn as a blueprint grid and "built" bottom-up as uReveal goes 0 -> 1.
export function createPanelMaterial({ map, imageAspect, panelAspect, accent, grid, fogColor, fogDensity }) {
  // Cover-fit the image to the panel, anchored to the top (screenshots read top-down).
  const scale = new THREE.Vector2(1, 1);
  if (imageAspect > panelAspect) scale.x = panelAspect / imageAspect;
  else scale.y = imageAspect / panelAspect;

  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uUvScale: { value: scale },
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(accent) },
      uGridColor: { value: new THREE.Color(grid) },
      uBase: { value: new THREE.Color("#04140c") },
      uFogColor: { value: new THREE.Color(fogColor) },
      uFogDensity: { value: fogDensity },
      uGrid: { value: new THREE.Vector2(32 * Math.min(panelAspect, 1.6), 20) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      ${FOG_VERT}
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec2 uUvScale;
      uniform float uReveal;
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uGridColor;
      uniform vec3 uBase;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec2 uGrid;
      varying vec2 vUv;
      varying float vDepth;
      ${NOISE}
      void main() {
        vec2 uv = vec2(0.5 + (vUv.x - 0.5) * uUvScale.x, 1.0 - (1.0 - vUv.y) * uUvScale.y);
        vec3 img = texture2D(uMap, uv).rgb;

        // Blueprint state: faint phosphor grid.
        vec2 g = fract(vUv * uGrid);
        float line = max(step(g.x, 0.035), step(g.y, 0.05));
        vec3 blueprint = uBase + uGridColor * line * 0.09;

        // A touch of phosphor tint so screenshots sit in the room. Scanlines come from the
        // page overlay only; doubling them here striped the screenshots.
        img = mix(img, img * vec3(0.86, 1.0, 0.9), 0.35) * 0.92;

        // Build front: a slightly noisy horizontal edge that climbs as uReveal grows.
        float edge = vUv.y + (noise(vec2(vUv.x * 7.0, uTime * 0.35)) - 0.5) * 0.06;
        float front = uReveal * 1.12 - 0.06;
        float built = 1.0 - smoothstep(front - 0.006, front + 0.006, edge);
        float building = step(0.001, uReveal) * step(uReveal, 0.999);
        float glow = (1.0 - smoothstep(0.0, 0.03, abs(edge - front))) * building;

        vec3 col = mix(blueprint, img, built) + uAccent * glow * 1.2;

        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Floor grid that fades into the fog. Lines sit every 2 world units.
export function createFloorMaterial({ fogColor, fogDensity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLine: { value: new THREE.Color("#0c2a1a") },
      uBase: { value: new THREE.Color(fogColor) },
      uFogColor: { value: new THREE.Color(fogColor) },
      uFogDensity: { value: fogDensity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      ${FOG_VERT}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xz;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLine;
      uniform vec3 uBase;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vWorld;
      varying float vDepth;
      void main() {
        vec2 coord = vWorld / 2.0;
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        vec3 col = mix(uBase, uLine, line);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Ambient floating dust particles. Drawn as soft circular motes with a near-camera distance fade
// so particles never blow up into large square artifacts when close to the lens.
export function createDustMaterial({ color = "#4f9a76", size = 0.045, opacity = 0.5 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uScale: { value: 500.0 },
      uSize: { value: size },
    },
    vertexShader: /* glsl */ `
      uniform float uScale;
      uniform float uSize;
      varying float vAlpha;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        // Fade out smoothly between 1.0 and 3.5 units from the camera
        vAlpha = smoothstep(1.0, 3.5, dist);
        // Point size inversely proportional to distance, strictly clamped so motes never get large
        float pSize = uSize * (uScale / max(dist, 0.1));
        gl_PointSize = clamp(pSize, 1.0, 4.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        // Soft radial falloff for a gentle glowing mote
        float radial = smoothstep(0.5, 0.05, dist);
        float a = radial * uOpacity * vAlpha;
        if (a < 0.005) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}


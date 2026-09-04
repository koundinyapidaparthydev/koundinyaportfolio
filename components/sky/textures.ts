import * as THREE from "three";

/**
 * Procedural canvas textures for the sky scene.
 * Everything is generated once at init — no external assets.
 */

/** deterministic PRNG so the sky looks identical on every load */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** soft radial glow (white, alpha falloff) — sun glow, moon halos, cloud puffs */
export function makeGlowTexture(size = 256, hardness = 0.0): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(Math.min(0.9, 0.18 + hardness), "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.16)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** procedural moon surface: gray base, maria blotches, craters with lit rims */
export function makeMoonTexture(width = 512, height = 256): THREE.CanvasTexture {
  return makeMoonTextures(width, height).map;
}

/** color map + grayscale bump map derived from the same procedural surface */
export function makeMoonTextures(width = 512, height = 256): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const rand = mulberry32(20260903);

  // base with a subtle vertical variation
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#b6b6ba");
  base.addColorStop(0.5, "#a9a9ae");
  base.addColorStop(1, "#9c9ca2");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // large-scale tonal blotches (fake maria + albedo variation)
  for (let i = 0; i < 16; i++) {
    const x = rand() * width;
    const y = height * 0.12 + rand() * height * 0.76;
    const r = 24 + rand() * 78;
    const dark = rand() > 0.35;
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, dark ? "rgba(96,96,106,0.5)" : "rgba(208,208,212,0.4)");
    g.addColorStop(1, "rgba(150,150,158,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // craters: dark bowl with a bright lower-right rim
  for (let i = 0; i < 170; i++) {
    const x = rand() * width;
    const y = height * 0.06 + rand() * height * 0.88;
    const r = 1.2 + Math.pow(rand(), 2.2) * 11;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(78,78,88,0.9)");
    g.addColorStop(0.7, "rgba(112,112,122,0.55)");
    g.addColorStop(1, "rgba(120,120,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // lit rim on the lower-right side
    ctx.strokeStyle = "rgba(228,228,234,0.55)";
    ctx.lineWidth = Math.max(0.8, r * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, Math.PI * 0.1, Math.PI * 0.7);
    ctx.stroke();
  }

  // fine grain noise
  for (let i = 0; i < 3200; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? "rgba(235,235,240,0.05)" : "rgba(40,40,48,0.05)";
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  // derive bump map from the same surface: darker craters = lower
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext("2d");
  if (!bCtx) throw new Error("2d context unavailable");
  bCtx.filter = "grayscale(100%)";
  bCtx.drawImage(canvas, 0, 0);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

/** puffy cloud sprite: overlapping soft blobs shaped by a radial mask */
export function makeCloudTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const rand = mulberry32(777);

  for (let i = 0; i < 22; i++) {
    const bx = size * (0.22 + rand() * 0.56);
    const by = size * (0.38 + rand() * 0.3);
    const r = size * (0.08 + rand() * 0.16);
    const a = 0.1 + rand() * 0.16;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // flatten the bottom a little (clouds are wider than tall)
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createLinearGradient(0, size * 0.15, 0, size);
  mask.addColorStop(0, "rgba(0,0,0,0)");
  mask.addColorStop(0.25, "rgba(0,0,0,1)");
  mask.addColorStop(0.8, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** stylised soaring bird silhouette, white on transparent — tinted by material color.
 *  Drawn as a shallow V-shaped wings + forked tail so it reads as a real bird at a distance.
 */
export function makeBirdTexture(width = 128, height = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#ffffff";

  const cx = width / 2;
  const cy = height * 0.62;

  ctx.beginPath();
  // left wingtip
  ctx.moveTo(4, 14);
  // leading edge to shoulder
  ctx.quadraticCurveTo(cx - 22, 46, cx - 10, cy - 2);
  // forked tail - left feather
  ctx.quadraticCurveTo(cx - 6, cy + 10, cx - 12, height - 6);
  ctx.lineTo(cx - 2, cy + 6);
  // forked tail - right feather
  ctx.lineTo(cx + 12, height - 6);
  ctx.quadraticCurveTo(cx + 6, cy + 10, cx + 10, cy - 2);
  // leading edge to right wingtip
  ctx.quadraticCurveTo(cx + 22, 46, width - 4, 14);
  // trailing edge back to centre
  ctx.quadraticCurveTo(cx + 18, 38, cx, 34);
  ctx.quadraticCurveTo(cx - 18, 38, 4, 14);
  ctx.closePath();
  ctx.fill();

  // small head
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Jagged mountain / treeline silhouette, white on transparent.
 * `rugged` controls peak amplitude (small = gentle treeline).
 */
export function makeRidgeTexture(seed: number, width = 1024, height = 128, rugged = 1): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const rand = mulberry32(seed);

  ctx.beginPath();
  ctx.moveTo(0, height);
  let x = 0;
  let y = height * (rugged > 0.5 ? 0.42 : 0.55);
  ctx.lineTo(0, y);
  while (x < width) {
    x += 18 + rand() * (rugged > 0.5 ? 70 : 26);
    const jitter = (rand() - 0.5) * height * 0.55 * rugged;
    const minY = height * (rugged > 0.5 ? 0.14 : 0.34);
    y = Math.min(height * 0.8, Math.max(minY, y + jitter));
    ctx.lineTo(Math.min(x, width), y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** elongated streak for shooting stars: bright head fading tail */
export function makeStreakTexture(width = 256, height = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const gx = ctx.createLinearGradient(0, 0, width, 0);
  gx.addColorStop(0, "rgba(255,255,255,0)");
  gx.addColorStop(0.75, "rgba(255,255,255,0.7)");
  gx.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "destination-in";
  const gy = ctx.createLinearGradient(0, 0, 0, height);
  gy.addColorStop(0, "rgba(0,0,0,0)");
  gy.addColorStop(0.5, "rgba(0,0,0,1)");
  gy.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

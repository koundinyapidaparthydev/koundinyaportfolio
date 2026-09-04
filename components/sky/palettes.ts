import * as THREE from "three";

/**
 * Time-of-day palette system for the sky.
 *
 * One module-level mutable clock (`skyClock`) is driven by scroll progress
 * (t = 0 at the top of the page = day, t = 1 at the bottom = deep night).
 * Every frame each visual component calls `sampleSky(skyClock.t)`, which
 * lerps between the keyframed stops below and returns a shared, preallocated
 * output object — no React state, no per-frame allocations.
 */

export interface SkyPaletteStop {
  /** scroll position 0..1 */
  t: number;
  /** dome gradient colors */
  top: string;
  horizon: string;
  /** sun disc / glow */
  sunColor: string;
  sunIntensity: number;
  /** sun position on the dome (radians) */
  sunElev: number;
  sunAz: number;
  /** moon halo brightness + position (radians) */
  moonIntensity: number;
  moonElev: number;
  moonAz: number;
  /** global star visibility 0..1 */
  starOpacity: number;
  /** cloud tint + overall cloud alpha */
  cloudTint: string;
  cloudOpacity: number;
  /** ambient light */
  ambientColor: string;
  ambientIntensity: number;
}

const stop = (s: SkyPaletteStop): SkyPaletteStop => s;

export const SKY_STOPS: SkyPaletteStop[] = [
  stop({
    t: 0.0,
    top: "#3b72c4",
    horizon: "#9fd6f0",
    sunColor: "#fff8e7",
    sunIntensity: 1.7,
    sunElev: 0.22,
    sunAz: -0.55,
    moonIntensity: 0,
    moonElev: -0.05,
    moonAz: 0.55,
    starOpacity: 0,
    cloudTint: "#ffffff",
    cloudOpacity: 0.72,
    ambientColor: "#d4e9ff",
    ambientIntensity: 0.9,
  }),
  stop({
    t: 0.18,
    top: "#2f4a86",
    horizon: "#f5a95c",
    sunColor: "#ffc36b",
    sunIntensity: 1.7,
    sunElev: 0.28,
    sunAz: -0.45,
    moonIntensity: 0.12,
    moonElev: 0.12,
    moonAz: 0.55,
    starOpacity: 0.03,
    cloudTint: "#ffbf96",
    cloudOpacity: 0.88,
    ambientColor: "#f0c897",
    ambientIntensity: 0.65,
  }),
  stop({
    t: 0.35,
    top: "#1d2650",
    horizon: "#e07a6e",
    sunColor: "#ff9a5e",
    sunIntensity: 1.4,
    sunElev: 0.08,
    sunAz: -0.3,
    moonIntensity: 0.35,
    moonElev: 0.24,
    moonAz: 0.55,
    starOpacity: 0.22,
    cloudTint: "#e79e8f",
    cloudOpacity: 0.84,
    ambientColor: "#b88a8a",
    ambientIntensity: 0.5,
  }),
  stop({
    t: 0.5,
    top: "#151b42",
    horizon: "#9e5a78",
    sunColor: "#ff8e5e",
    sunIntensity: 0.35,
    sunElev: -0.04,
    sunAz: -0.18,
    moonIntensity: 0.65,
    moonElev: 0.34,
    moonAz: 0.55,
    starOpacity: 0.55,
    cloudTint: "#b97f95",
    cloudOpacity: 0.78,
    ambientColor: "#7a6a9a",
    ambientIntensity: 0.4,
  }),
  stop({
    t: 0.65,
    top: "#0d1334",
    horizon: "#463a6b",
    sunColor: "#ff8e5e",
    sunIntensity: 0,
    sunElev: -0.2,
    sunAz: 0.1,
    moonIntensity: 0.85,
    moonElev: 0.42,
    moonAz: 0.55,
    starOpacity: 0.8,
    cloudTint: "#4a4668",
    cloudOpacity: 0.7,
    ambientColor: "#4a5280",
    ambientIntensity: 0.35,
  }),
  stop({
    t: 0.85,
    top: "#050a1e",
    horizon: "#131f42",
    sunColor: "#ff8e5e",
    sunIntensity: 0,
    sunElev: -0.4,
    sunAz: 0.15,
    moonIntensity: 1.0,
    moonElev: 0.48,
    moonAz: 0.55,
    starOpacity: 1,
    cloudTint: "#2c3654",
    cloudOpacity: 0.6,
    ambientColor: "#33406b",
    ambientIntensity: 0.3,
  }),
  stop({
    t: 1.0,
    top: "#040816",
    horizon: "#0e1836",
    sunColor: "#ff8e5e",
    sunIntensity: 0,
    sunElev: -0.45,
    sunAz: 0.18,
    moonIntensity: 1.0,
    moonElev: 0.52,
    moonAz: 0.55,
    starOpacity: 1,
    cloudTint: "#28324e",
    cloudOpacity: 0.55,
    ambientColor: "#2e3a63",
    ambientIntensity: 0.28,
  }),
];

export interface SampledSky {
  top: THREE.Color;
  horizon: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunElev: number;
  sunAz: number;
  moonIntensity: number;
  moonElev: number;
  moonAz: number;
  starOpacity: number;
  cloudTint: THREE.Color;
  cloudOpacity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
}

const sampled: SampledSky = {
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  sunColor: new THREE.Color(),
  sunIntensity: 0,
  sunElev: 0,
  sunAz: 0,
  moonIntensity: 0,
  moonElev: 0,
  moonAz: 0,
  starOpacity: 0,
  cloudTint: new THREE.Color(),
  cloudOpacity: 1,
  ambientColor: new THREE.Color(),
  ambientIntensity: 1,
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** classic smoothstep easing between stops */
const smooth = (x: number): number => x * x * (3 - 2 * x);

const mixColor = (a: string, b: string, f: number, out: THREE.Color): void => {
  out.copy(tmpA.set(a)).lerp(tmpB.set(b), f);
};

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/**
 * Sample the palette at scroll position t (0..1).
 * Returns a shared mutable object — read it immediately, never store it.
 */
export function sampleSky(t: number): SampledSky {
  const stops = SKY_STOPS;
  const tc = clamp01(t);
  let i = 0;
  while (i < stops.length - 2 && tc > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const span = Math.max(1e-6, b.t - a.t);
  const f = smooth(clamp01((tc - a.t) / span));

  mixColor(a.top, b.top, f, sampled.top);
  mixColor(a.horizon, b.horizon, f, sampled.horizon);
  mixColor(a.sunColor, b.sunColor, f, sampled.sunColor);
  sampled.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, f);
  sampled.sunElev = lerp(a.sunElev, b.sunElev, f);
  sampled.sunAz = lerp(a.sunAz, b.sunAz, f);
  sampled.moonIntensity = lerp(a.moonIntensity, b.moonIntensity, f);
  sampled.moonElev = lerp(a.moonElev, b.moonElev, f);
  sampled.moonAz = lerp(a.moonAz, b.moonAz, f);
  sampled.starOpacity = lerp(a.starOpacity, b.starOpacity, f);
  mixColor(a.cloudTint, b.cloudTint, f, sampled.cloudTint);
  sampled.cloudOpacity = lerp(a.cloudOpacity, b.cloudOpacity, f);
  mixColor(a.ambientColor, b.ambientColor, f, sampled.ambientColor);
  sampled.ambientIntensity = lerp(a.ambientIntensity, b.ambientIntensity, f);
  return sampled;
}

/** Position on the sky dome. Azimuth 0 faces the camera (-z). */
export function domePosition(elev: number, az: number, radius: number, out: THREE.Vector3): THREE.Vector3 {
  const ce = Math.cos(elev);
  return out.set(radius * ce * Math.sin(az), radius * Math.sin(elev), -radius * ce * Math.cos(az));
}

/**
 * Module-level mutable sky clock. Driven imperatively from useFrame —
 * deliberately NOT React state so the render loop never triggers re-renders.
 */
export const skyClock = {
  /** current smoothed scroll time 0..1 */
  t: 0,
  /** raw scroll target 0..1 */
  target: 0,
  /** smoothed pointer position, normalized -1..1 */
  pointerX: 0,
  pointerY: 0,
  /** raw pointer target, normalized -1..1 */
  pointerTargetX: 0,
  pointerTargetY: 0,
};

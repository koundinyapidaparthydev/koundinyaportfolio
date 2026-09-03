"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { domePosition, sampleSky, skyClock } from "./palettes";
import {
  makeBirdTexture,
  makeCloudTexture,
  makeGlowTexture,
  makeMoonTexture,
  makeRidgeTexture,
  makeStreakTexture,
} from "./textures";

/* ── performance tiers ─────────────────────────────────────────────── */
const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);

const STAR_COUNT = IS_MOBILE ? 900 : 2200;
const CLOUD_LAYERS: Array<{ count: number; yMin: number; yMax: number; z: number; scale: number; speed: number; opacity: number }> = [
  { count: IS_MOBILE ? 22 : 46, yMin: -3, yMax: 15, z: -55, scale: 13, speed: 0.55, opacity: 0.85 },
  { count: IS_MOBILE ? 16 : 36, yMin: 2, yMax: 22, z: -85, scale: 24, speed: 0.3, opacity: 0.6 },
];

const DOME_RADIUS = 220;
const tmpVec = new THREE.Vector3();

/* ── scroll-driven clock ───────────────────────────────────────────── */
function TimeDriver() {
  useFrame((_, dt) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    skyClock.target = THREE.MathUtils.clamp(window.scrollY / max, 0, 1);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 2.4);
    skyClock.t += (skyClock.target - skyClock.t) * k;
  });
  return null;
}

/* ── cursor parallax / autonomous sway ─────────────────────────────── */
function CameraRig() {
  useEffect(() => {
    if (IS_MOBILE) return;
    const onMove = (e: PointerEvent) => {
      skyClock.pointerTargetX = (e.clientX / window.innerWidth) * 2 - 1;
      skyClock.pointerTargetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ camera, clock }) => {
    let tx: number;
    let ty: number;
    if (IS_MOBILE) {
      tx = Math.sin(clock.elapsedTime * 0.12) * 0.55;
      ty = Math.cos(clock.elapsedTime * 0.09) * 0.3;
    } else {
      skyClock.pointerX += (skyClock.pointerTargetX - skyClock.pointerX) * 0.055;
      skyClock.pointerY += (skyClock.pointerTargetY - skyClock.pointerY) * 0.055;
      tx = skyClock.pointerX;
      ty = skyClock.pointerY;
    }
    camera.position.x = tx * 0.9;
    camera.position.y = 1.2 - ty * 0.55;
    camera.lookAt(0, 1.5, -40);
  });
  return null;
}

/* ── gradient sky dome ─────────────────────────────────────────────── */
function Dome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color("#2a5da8") },
          uHorizon: { value: new THREE.Color("#8fc3e4") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            float up = clamp(y, 0.0, 1.0);
            vec3 col = mix(uTop, uHorizon, pow(1.0 - up, 1.7));
            // darken below the horizon so ridges sit on solid ground
            col = mix(col, uHorizon * 0.45, smoothstep(0.02, -0.18, y));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const s = sampleSky(skyClock.t);
    (material.uniforms.uTop.value as THREE.Color).copy(s.top);
    (material.uniforms.uHorizon.value as THREE.Color).copy(s.horizon);
  });

  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[DOME_RADIUS, 32, 24]} />
    </mesh>
  );
}

/* ── twinkling stars ───────────────────────────────────────────────── */
function Stars() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aPhase;
          attribute float aTint;
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vAlpha;
          varying float vTint;
          void main() {
            vTint = aTint;
            float tw = 0.55 + 0.45 * sin(uTime * (1.1 + fract(aPhase * 0.37) * 1.9) + aPhase);
            vAlpha = tw;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (220.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying float vAlpha;
          varying float vTint;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.06, d);
            vec3 col = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.93, 0.82), vTint);
            gl_FragColor = vec4(col, a * vAlpha * uOpacity);
          }
        `,
      }),
    []
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const tints = new Float32Array(STAR_COUNT);
    const R = 190;
    for (let i = 0; i < STAR_COUNT; i++) {
      // dome distribution, biased toward the upper sky
      const az = Math.random() * Math.PI * 2;
      const el = Math.asin(Math.pow(Math.random(), 0.75));
      positions[i * 3] = R * Math.cos(el) * Math.sin(az);
      positions[i * 3 + 1] = R * Math.sin(el) - 8;
      positions[i * 3 + 2] = -R * Math.cos(el) * Math.cos(az);
      sizes[i] = 0.8 + Math.pow(Math.random(), 2.5) * 2.6;
      phases[i] = Math.random() * 100;
      tints[i] = Math.random();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 1));
    return geo;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(({ gl, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    material.uniforms.uOpacity.value = sampleSky(skyClock.t).starOpacity;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ── lights that follow the palette ────────────────────────────────── */
function SkyLights() {
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const s = sampleSky(skyClock.t);
    if (ambient.current) {
      ambient.current.color.copy(s.ambientColor);
      ambient.current.intensity = s.ambientIntensity;
    }
    if (sun.current) {
      domePosition(s.sunElev, s.sunAz, 100, tmpVec);
      sun.current.position.copy(tmpVec);
      sun.current.color.copy(s.sunColor);
      sun.current.intensity = s.sunIntensity * 1.3;
    }
    if (moon.current) {
      // light from upper-left-front of the moon so the camera-facing
      // hemisphere is lit and craters cast subtle shadows
      domePosition(s.moonElev, s.moonAz, 150, tmpVec);
      moon.current.position.set(tmpVec.x - 55, tmpVec.y + 38, tmpVec.z + 100);
      moon.current.intensity = s.moonIntensity * 1.8;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.6} />
      <directionalLight ref={sun} intensity={1} />
      <directionalLight ref={moon} intensity={0} color="#a8bcff" />
    </>
  );
}

/* ── sun: hot core + wide additive glow ────────────────────────────── */
function Sun() {
  const glow = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);

  const glowTex = useMemo(() => makeGlowTexture(256), []);
  const coreTex = useMemo(() => makeGlowTexture(256, 0.5), []);

  useEffect(
    () => () => {
      glowTex.dispose();
      coreTex.dispose();
    },
    [glowTex, coreTex]
  );

  useFrame(() => {
    const s = sampleSky(skyClock.t);
    domePosition(s.sunElev, s.sunAz, 170, tmpVec);
    const horizonFade = THREE.MathUtils.smoothstep(s.sunElev, -0.1, 0.04);
    const intensity = s.sunIntensity * horizonFade;
    for (const [ref, scale, baseOpacity] of [
      [glow, 42, 0.55],
      [core, 13, 0.95],
    ] as const) {
      const sp = ref.current;
      if (!sp) continue;
      sp.position.copy(tmpVec);
      const sc = scale * Math.max(0.001, intensity);
      sp.scale.set(sc, sc, 1);
      (sp.material as THREE.SpriteMaterial).opacity = baseOpacity * Math.min(1, intensity);
      (sp.material as THREE.SpriteMaterial).color.copy(s.sunColor);
    }
  });

  return (
    <>
      <sprite ref={glow}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={core}>
        <spriteMaterial map={coreTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

/* ── moon: procedural craters + halo ───────────────────────────────── */
function Moon() {
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const outer = useRef<THREE.Sprite>(null);

  const moonTex = useMemo(() => makeMoonTexture(512, 256), []);
  const haloTex = useMemo(() => makeGlowTexture(256), []);
  const outerTex = useMemo(() => makeGlowTexture(256), []);

  useEffect(
    () => () => {
      moonTex.dispose();
      haloTex.dispose();
      outerTex.dispose();
    },
    [moonTex, haloTex, outerTex]
  );

  useFrame(({ clock }) => {
    const s = sampleSky(skyClock.t);
    const drift = Math.sin(clock.elapsedTime * 0.02) * 0.04;
    domePosition(s.moonElev, s.moonAz + drift, 150, tmpVec);
    if (mesh.current) {
      mesh.current.position.copy(tmpVec);
      mesh.current.rotation.y = clock.elapsedTime * 0.008 + 2.1;
    }
    for (const [ref, scale, baseOpacity] of [
      [halo, 12, 0.32],
      [outer, 34, 0.12],
    ] as const) {
      const sp = ref.current;
      if (!sp) continue;
      sp.position.copy(tmpVec);
      const sc = scale * (0.4 + 0.6 * s.moonIntensity);
      sp.scale.set(sc, sc, 1);
      (sp.material as THREE.SpriteMaterial).opacity = baseOpacity * s.moonIntensity;
    }
  });

  return (
    <>
      <sprite ref={outer} renderOrder={-5}>
        <spriteMaterial map={outerTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#aebfff" />
      </sprite>
      <sprite ref={halo} renderOrder={-4}>
        <spriteMaterial map={haloTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#cdd8ff" />
      </sprite>
      <mesh ref={mesh}>
        <sphereGeometry args={[2.7, 48, 32]} />
        <meshPhongMaterial
          map={moonTex}
          emissive="#34363f"
          emissiveIntensity={0.55}
          shininess={6}
          specular="#3a3a44"
        />
      </mesh>
    </>
  );
}

/* ── instanced drifting clouds ─────────────────────────────────────── */
interface CloudLayerProps {
  yMin: number;
  yMax: number;
  z: number;
  scale: number;
  speed: number;
  opacity: number;
  count: number;
}

function CloudLayer({ yMin, yMax, z, scale, speed, opacity, count }: CloudLayerProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const SPAN = 280;

  const { geometry, material, cloudTex } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 0.62);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));

    const tex = makeCloudTexture(256);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: tex },
        uTint: { value: new THREE.Color("#ffffff") },
        uOpacity: { value: 1 },
        uTime: { value: 0 },
        uSpan: { value: SPAN },
        uSpeed: { value: speed },
        uLayerOpacity: { value: opacity },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uSpan;
        uniform float uSpeed;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vUv = uv;
          vAlpha = 0.4 + 0.6 * fract(aSeed * 3.71);
          vec3 center = vec3(instanceMatrix[3]);
          vec3 local = (instanceMatrix * vec4(position, 0.0)).xyz;
          float s = uSpeed * (0.5 + 0.9 * fract(aSeed * 7.13));
          float wrapped = mod(center.x + uTime * s + uSpan * 0.5, uSpan) - uSpan * 0.5;
          vec3 world = vec3(wrapped, center.y, center.z) + local;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uTint;
        uniform float uOpacity;
        uniform float uLayerOpacity;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          float shade = mix(0.7, 1.06, vUv.y);
          vec3 col = uTint * shade + vec3(0.07) * smoothstep(0.6, 0.95, vUv.y);
          float a = tex.a * vAlpha * uOpacity * uLayerOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    return { geometry: geo, material: mat, cloudTex: tex };
  }, [count, speed, opacity, SPAN]);

  useEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      pos.set((Math.random() - 0.5) * SPAN, yMin + Math.random() * (yMax - yMin), z + (Math.random() - 0.5) * 12);
      eul.set(0, 0, (Math.random() - 0.5) * 0.35);
      q.setFromEuler(eul);
      const s = scale * (0.7 + Math.random() * 1.1);
      scl.set(s, s, s);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [count, yMin, yMax, z, scale, SPAN]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      cloudTex.dispose();
    },
    [geometry, material, cloudTex]
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    const s = sampleSky(skyClock.t);
    (material.uniforms.uTint.value as THREE.Color).copy(s.cloudTint);
    material.uniforms.uOpacity.value = s.cloudOpacity;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} renderOrder={2} />;
}

/* ── distant mountain / treeline silhouettes ───────────────────────── */
function Ridges() {
  const near = useRef<THREE.Mesh>(null);
  const far = useRef<THREE.Mesh>(null);

  const { nearTex, farTex } = useMemo(
    () => ({ nearTex: makeRidgeTexture(11, 1024, 128, 1), farTex: makeRidgeTexture(23, 1024, 128, 0.35) }),
    []
  );
  useEffect(
    () => () => {
      nearTex.dispose();
      farTex.dispose();
    },
    [nearTex, farTex]
  );

  const dayNear = useMemo(() => new THREE.Color("#35476a"), []);
  const dayFar = useMemo(() => new THREE.Color("#4d5f80"), []);
  const night = useMemo(() => new THREE.Color("#05070f"), []);

  useFrame(() => {
    const s = sampleSky(skyClock.t);
    const f = s.starOpacity;
    if (near.current) {
      const c = (near.current.material as THREE.MeshBasicMaterial).color;
      c.copy(dayNear).lerp(night, f).lerp(s.horizon, 0.16 * (1 - f));
    }
    if (far.current) {
      const c = (far.current.material as THREE.MeshBasicMaterial).color;
      c.copy(dayFar).lerp(night, f * 0.9).lerp(s.horizon, 0.38 * (1 - f));
    }
  });

  return (
    <group renderOrder={1}>
      <mesh ref={far} position={[0, -17, -150]}>
        <planeGeometry args={[520, 22]} />
        <meshBasicMaterial map={farTex} transparent depthWrite={false} />
      </mesh>
      <mesh ref={near} position={[0, -20, -110]}>
        <planeGeometry args={[460, 26]} />
        <meshBasicMaterial map={nearTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── daytime bird flocks ───────────────────────────────────────────── */
const FLOCK_OFFSETS: Array<[number, number, number]> = [
  [0, 0, 0],
  [-2.1, -0.5, -0.6],
  [2.1, -0.4, -0.5],
  [-4, -1.1, -1.2],
  [4, -1, -1.1],
  [-1.1, -1.4, -1.8],
  [1.3, -1.5, -1.9],
];

function BirdFlock({ offset, baseY, z, speed, size }: { offset: number; baseY: number; z: number; speed: number; size: number }) {
  const group = useRef<THREE.Group>(null);
  const birdTex = useMemo(() => makeBirdTexture(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: birdTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: "#141b2a",
      }),
    [birdTex]
  );

  const birds = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2.4, 1.2);
    return FLOCK_OFFSETS.slice(0, IS_MOBILE ? 5 : FLOCK_OFFSETS.length).map(([dx, dy, dz], i) => ({
      mesh: new THREE.Mesh(geo, material),
      dx: dx * size,
      dy: dy * size,
      dz: dz * size,
      phase: i * 1.7 + offset * 5,
      geo,
    }));
  }, [material, offset, size]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    for (const b of birds) g.add(b.mesh);
    return () => {
      for (const b of birds) {
        g.remove(b.mesh);
        b.geo.dispose();
      }
    };
  }, [birds]);

  useEffect(
    () => () => {
      material.dispose();
      birdTex.dispose();
    },
    [material, birdTex]
  );

  useFrame(({ clock }) => {
    const s = sampleSky(skyClock.t);
    const dayFactor = THREE.MathUtils.clamp(1 - s.starOpacity * 2.4, 0, 1);
    const g = group.current;
    if (!g) return;
    g.visible = dayFactor > 0.02;
    if (!g.visible) return;
    material.opacity = dayFactor * 0.9;
    const progress = (clock.elapsedTime * speed + offset) % 1;
    const x = THREE.MathUtils.lerp(-80, 80, progress);
    const y = baseY + Math.sin(progress * Math.PI * 2 + offset * 9) * 3.5;
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(progress * Math.PI * 2) * 0.12;
    for (const b of birds) {
      b.mesh.position.set(b.dx, b.dy + Math.sin(clock.elapsedTime * 0.7 + b.phase) * 0.4, b.dz);
      b.mesh.scale.y = 1 + 0.5 * Math.sin(clock.elapsedTime * (5.5 + b.phase * 0.15) + b.phase);
    }
  });

  return <group ref={group} />;
}

/* ── shooting stars (night only) ───────────────────────────────────── */
function ShootingStar({ seedOffset }: { seedOffset: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const streakTex = useMemo(() => makeStreakTexture(), []);
  const state = useRef({
    next: 2.5 + seedOffset * 4,
    start: -1,
    dur: 0.85,
    from: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    angle: 0,
  });

  useEffect(() => () => streakTex.dispose(), [streakTex]);

  useFrame(({ clock }) => {
    const s = sampleSky(skyClock.t);
    const m = mesh.current;
    if (!m) return;
    const st = state.current;
    const el = clock.elapsedTime;

    if (st.start < 0) {
      m.visible = false;
      if (el >= st.next && s.starOpacity > 0.45) {
        const elev = THREE.MathUtils.degToRad(28 + Math.random() * 32);
        const az = (Math.random() - 0.5) * 2.2;
        domePosition(elev, az, 130, st.from);
        // mostly-horizontal tangent with a slight downward slope
        st.dir
          .set(Math.cos(az) * (Math.random() > 0.5 ? 1 : -1), -0.25 - Math.random() * 0.4, Math.sin(az) * 0.3)
          .normalize();
        st.angle = Math.atan2(st.dir.y, st.dir.x);
        st.start = el;
      }
      return;
    }

    const p = (el - st.start) / st.dur;
    if (p >= 1) {
      st.start = -1;
      st.next = el + 6 + Math.random() * 6;
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.copy(st.from).addScaledVector(st.dir, p * 34);
    m.rotation.z = st.angle;
    (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.9 * s.starOpacity;
  });

  return (
    <mesh ref={mesh} visible={false} renderOrder={4}>
      <planeGeometry args={[16, 0.55]} />
      <meshBasicMaterial
        map={streakTex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#dff0ff"
      />
    </mesh>
  );
}

/* ── root canvas ───────────────────────────────────────────────────── */
export default function SkyScene({ paused }: { paused: boolean }) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 1.75]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 60, position: [0, 1.2, 10], near: 0.1, far: 600 }}
    >
      <TimeDriver />
      <CameraRig />
      <SkyLights />
      <Dome />
      <Stars />
      <Sun />
      <Moon />
      {CLOUD_LAYERS.map((layer, i) => (
        <CloudLayer key={i} {...layer} />
      ))}
      <Ridges />
      <BirdFlock offset={0.15} baseY={14} z={-60} speed={0.012} size={1} />
      <BirdFlock offset={0.62} baseY={20} z={-80} speed={0.009} size={1.4} />
      <ShootingStar seedOffset={0} />
      <ShootingStar seedOffset={1} />
    </Canvas>
  );
}

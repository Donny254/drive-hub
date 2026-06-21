import { useRef, useMemo, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import heroDashboard from "@/assets/hero-dashboard.jpg";

class WebGLErrorBoundary extends Component<{ children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroDashboard})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---- palette (matches the orange brand theme + GT3 reference) ---- */
const ACCENT = "#ff6a13";
const NEEDLE = "#ffb020";
const TICK = "#5a6b8c";
const TICK_HI = "#d6e4ff";
const RED = "#ff2a1a";
const FACE = "#080b11";
const BEZEL = "#171c26";

/* gauge sweep: 270deg, from lower-left (value min) to lower-right (value max) */
const START = (135 * Math.PI) / 180;
const END = (-135 * Math.PI) / 180;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const angleAt = (t: number) => START + clamp01(t) * (END - START);
const dirAt = (a: number) => new THREE.Vector2(-Math.sin(a), Math.cos(a));

interface GaugeProps {
  position: [number, number, number];
  radius: number;
  majors: number[];
  redlineFrom?: number; // 0..1, ticks at/after this are red
  label?: string;
  needleRef?: React.Ref<THREE.Group>;
}

function Gauge({ position, radius, majors, redlineFrom = 2, label, needleRef }: GaugeProps) {
  const { majorTicks, minorTicks, numbers } = useMemo(() => {
    const majorTicks: { pos: [number, number, number]; rot: number; red: boolean }[] = [];
    const minorTicks: { pos: [number, number, number]; rot: number; red: boolean }[] = [];
    const numbers: { pos: [number, number, number]; value: number; red: boolean }[] = [];
    const total = majors.length - 1;

    majors.forEach((value, i) => {
      const t = i / total;
      const a = angleAt(t);
      const d = dirAt(a);
      const red = t >= redlineFrom - 1e-6;
      majorTicks.push({ pos: [d.x * radius * 0.84, d.y * radius * 0.84, 0.02], rot: a, red });
      numbers.push({ pos: [d.x * radius * 0.66, d.y * radius * 0.66, 0.04], value, red });

      if (i < total) {
        for (let j = 1; j < 5; j++) {
          const tm = (i + j / 5) / total;
          const am = angleAt(tm);
          const dm = dirAt(am);
          minorTicks.push({ pos: [dm.x * radius * 0.88, dm.y * radius * 0.88, 0.02], rot: am, red: tm >= redlineFrom });
        }
      }
    });
    return { majorTicks, minorTicks, numbers };
  }, [radius, majors, redlineFrom]);

  return (
    <group position={position}>
      {/* recessed well */}
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[radius * 1.08, 64]} />
        <meshStandardMaterial color="#04060a" />
      </mesh>
      {/* face */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[radius * 0.99, 64]} />
        <meshStandardMaterial color={FACE} metalness={0.3} roughness={0.85} />
      </mesh>
      {/* bezel ring */}
      <mesh>
        <torusGeometry args={[radius, 0.055, 16, 80]} />
        <meshStandardMaterial color={BEZEL} metalness={0.85} roughness={0.35} />
      </mesh>
      {/* inner glow ring */}
      <mesh position={[0, 0, 0.01]}>
        <torusGeometry args={[radius * 0.93, 0.012, 12, 80]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.4} />
      </mesh>

      {/* minor ticks */}
      {minorTicks.map((tk, i) => (
        <mesh key={`mn${i}`} position={tk.pos} rotation={[0, 0, tk.rot]}>
          <boxGeometry args={[0.018, radius * 0.06, 0.02]} />
          <meshStandardMaterial color={tk.red ? RED : TICK} emissive={tk.red ? RED : TICK} emissiveIntensity={tk.red ? 0.8 : 0.25} />
        </mesh>
      ))}
      {/* major ticks */}
      {majorTicks.map((tk, i) => (
        <mesh key={`mj${i}`} position={tk.pos} rotation={[0, 0, tk.rot]}>
          <boxGeometry args={[0.04, radius * 0.13, 0.025]} />
          <meshStandardMaterial color={tk.red ? RED : TICK_HI} emissive={tk.red ? RED : TICK_HI} emissiveIntensity={tk.red ? 1.4 : 0.6} />
        </mesh>
      ))}
      {/* numbers */}
      {numbers.map((n, i) => (
        <Text
          key={`nm${i}`}
          position={n.pos}
          fontSize={radius * 0.13}
          color={n.red ? RED : TICK_HI}
          anchorX="center"
          anchorY="middle"
        >
          {n.value}
        </Text>
      ))}

      {label && (
        <Text position={[0, radius * 0.34, 0.05]} fontSize={radius * 0.12} color={ACCENT} anchorX="center" anchorY="middle" letterSpacing={0.2}>
          {label}
        </Text>
      )}

      {/* needle */}
      <group ref={needleRef}>
        <mesh position={[0, radius * 0.4, 0.05]}>
          <coneGeometry args={[radius * 0.035, radius * 0.82, 4]} />
          <meshStandardMaterial color={NEEDLE} emissive={NEEDLE} emissiveIntensity={1.8} />
        </mesh>
        {/* counterweight */}
        <mesh position={[0, -radius * 0.13, 0.05]}>
          <boxGeometry args={[radius * 0.07, radius * 0.2, 0.04]} />
          <meshStandardMaterial color={NEEDLE} emissive={NEEDLE} emissiveIntensity={0.9} />
        </mesh>
      </group>
      {/* hub cap */}
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.08, radius * 0.08, 0.05, 24]} />
        <meshStandardMaterial color="#15181f" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

interface DigitalGaugeProps {
  position: [number, number, number];
  radius: number;
  dotRef?: React.Ref<THREE.Group>;
}

function DigitalGauge({ position, radius, dotRef }: DigitalGaugeProps) {
  const ringPts = useMemo(() => Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2), []);
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[radius * 1.08, 64]} />
        <meshStandardMaterial color="#04060a" />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[radius * 0.99, 64]} />
        <meshStandardMaterial color="#06121a" metalness={0.2} roughness={0.6} emissive="#04212e" emissiveIntensity={0.4} />
      </mesh>
      <mesh>
        <torusGeometry args={[radius, 0.055, 16, 80]} />
        <meshStandardMaterial color={BEZEL} metalness={0.85} roughness={0.35} />
      </mesh>

      <Text position={[0, radius * 0.62, 0.04]} fontSize={radius * 0.14} color="#7fd8ff" anchorX="center" anchorY="middle" letterSpacing={0.15}>
        G-FORCE
      </Text>

      {/* g-force grid ring */}
      <mesh position={[0, -radius * 0.05, 0.02]}>
        <torusGeometry args={[radius * 0.5, 0.008, 8, 60]} />
        <meshStandardMaterial color="#2b6f8c" emissive="#2b6f8c" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, -radius * 0.05, 0.02]}>
        <torusGeometry args={[radius * 0.26, 0.006, 8, 48]} />
        <meshStandardMaterial color="#2b6f8c" emissive="#2b6f8c" emissiveIntensity={0.5} />
      </mesh>
      {/* crosshair */}
      <mesh position={[0, -radius * 0.05, 0.02]}>
        <boxGeometry args={[radius * 1.0, 0.006, 0.01]} />
        <meshStandardMaterial color="#2b6f8c" emissive="#2b6f8c" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -radius * 0.05, 0.02]}>
        <boxGeometry args={[0.006, radius * 1.0, 0.01]} />
        <meshStandardMaterial color="#2b6f8c" emissive="#2b6f8c" emissiveIntensity={0.4} />
      </mesh>

      {/* moving g dot */}
      <group ref={dotRef} position={[0, -radius * 0.05, 0.05]}>
        <mesh>
          <circleGeometry args={[radius * 0.07, 24]} />
          <meshStandardMaterial color={NEEDLE} emissive={NEEDLE} emissiveIntensity={2} />
        </mesh>
      </group>

      <Text position={[0, -radius * 0.72, 0.04]} fontSize={radius * 0.16} color="#d6e4ff" anchorX="center" anchorY="middle">
        129 mi
      </Text>

      {/* decorative segment ring */}
      {ringPts.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * radius * 0.9, Math.sin(a) * radius * 0.9, 0.01]} rotation={[0, 0, a]}>
          <boxGeometry args={[0.015, radius * 0.04, 0.01]} />
          <meshStandardMaterial color="#1f3a4a" emissive="#1f3a4a" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

interface TroikaText { text: string; sync?: () => void; }

function Cluster() {
  const tachNeedle = useRef<THREE.Group>(null);
  const speedNeedle = useRef<THREE.Group>(null);
  const gDot = useRef<THREE.Group>(null);
  const speedText = useRef<TroikaText>(null);
  const gearText = useRef<TroikaText>(null);
  const group = useRef<THREE.Group>(null);

  const sim = useRef({ speed: 0, rpm: 0.12, gear: 1, phase: "accel" as "accel" | "brake" });
  const last = useRef({ mph: -1, gear: -1 });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = sim.current;

    if (s.phase === "accel") {
      s.rpm += dt * 0.62;
      if (s.rpm >= 0.95) {
        if (s.gear < 6) { s.gear += 1; s.rpm = 0.46; }
        else s.rpm = 0.95;
      }
      s.speed = Math.min(1, s.speed + dt * (0.045 + s.rpm * 0.05));
      if (s.speed >= 0.97) s.phase = "brake";
    } else {
      s.rpm += (0.12 - s.rpm) * dt * 3.5;
      s.speed = Math.max(0, s.speed - dt * 0.2);
      if (s.speed <= 0.03) { s.phase = "accel"; s.gear = 1; s.rpm = 0.14; }
    }

    // tiny vibration on the needles for life
    const jitter = Math.sin(state.clock.elapsedTime * 40) * 0.004;
    if (tachNeedle.current) tachNeedle.current.rotation.z = angleAt(s.rpm) + jitter;
    if (speedNeedle.current) speedNeedle.current.rotation.z = angleAt(s.speed);

    // g-force dot reacts to accel / braking
    if (gDot.current) {
      const t = state.clock.elapsedTime;
      const lat = Math.sin(t * 2.1) * 0.05;
      const lon = s.phase === "accel" ? -s.rpm * 0.18 : 0.22;
      gDot.current.position.x = lat;
      gDot.current.position.y = -0.05 - lon;
    }

    // digital readouts (only sync on integer change)
    const mph = Math.round(s.speed * 225);
    if (mph !== last.current.mph && speedText.current) {
      speedText.current.text = `${mph}`;
      speedText.current.sync?.();
      last.current.mph = mph;
    }
    if (s.gear !== last.current.gear && gearText.current) {
      gearText.current.text = `${s.gear}`;
      gearText.current.sync?.();
      last.current.gear = s.gear;
    }

    // gentle idle parallax for the whole cluster
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.3) * 0.05;
      group.current.rotation.x = -0.12 + Math.sin(t * 0.4) * 0.015;
      group.current.position.y = Math.sin(t * 0.8) * 0.02;
    }
  });

  return (
    <group ref={group} rotation={[-0.12, 0, 0]}>
      {/* central tachometer */}
      <Gauge
        position={[0, 0, 0]}
        radius={1.45}
        majors={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        redlineFrom={0.8}
        label="GT3"
        needleRef={tachNeedle}
      />
      {/* gear + mph digital readout in the tach */}
      <Text ref={gearText} position={[0, -0.5, 0.1]} fontSize={0.34} color={ACCENT} anchorX="center" anchorY="middle">
        1
      </Text>
      <Text position={[0, -0.86, 0.1]} fontSize={0.13} color="#7c8aa3" anchorX="center" anchorY="middle" letterSpacing={0.2}>
        GEAR
      </Text>
      <group position={[0, -1.12, 0.1]}>
        <Text ref={speedText} position={[-0.12, 0, 0]} fontSize={0.22} color={TICK_HI} anchorX="right" anchorY="middle">
          0
        </Text>
        <Text position={[0.05, -0.01, 0]} fontSize={0.12} color="#7c8aa3" anchorX="left" anchorY="middle">
          mph
        </Text>
      </group>

      {/* speedometer */}
      <Gauge
        position={[-2.75, 0.05, -0.15]}
        radius={1.15}
        majors={[0, 25, 50, 75, 100, 125, 150, 175, 200, 225]}
        label="MPH"
        needleRef={speedNeedle}
      />

      {/* digital G-force gauge */}
      <DigitalGauge position={[2.75, 0.05, -0.15]} radius={1.1} dotRef={gDot} />
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 1.5, 4]} intensity={18} color="#fff2e0" distance={20} />
      <pointLight position={[0, 0, 3]} intensity={8} color={ACCENT} distance={12} />
      <directionalLight position={[-4, 6, 5]} intensity={0.5} color="#cfe0ff" />
    </>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.1, 6.4]} fov={52} />
      <fog attach="fog" args={["#03060a", 9, 22]} />
      <Lights />
      <Cluster />
      {/* faint horizon glow */}
      <mesh position={[0, 0, -6]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.08} transparent opacity={0.08} />
      </mesh>
    </>
  );
}

export default function DriveScene3D() {
  return (
    <WebGLErrorBoundary>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </WebGLErrorBoundary>
  );
}

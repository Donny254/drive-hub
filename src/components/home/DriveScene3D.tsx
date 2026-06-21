import { useRef, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
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

function Car() {
  const groupRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = Math.sin(t * 9) * 0.012;
    groupRef.current.rotation.z = Math.sin(t * 4.5) * 0.004;
    wheelsRef.current.forEach((w) => {
      if (w) w.rotation.x -= 0.18;
    });
  });

  const bodyColor = "#ff6a13";
  const bodyMat = { color: bodyColor, metalness: 0.75, roughness: 0.2 };
  const darkMat = { color: "#0a0e14", metalness: 0.4, roughness: 0.7 };
  const glassMat = { color: "#ffd9a8", metalness: 0.0, roughness: 0.0, transparent: true, opacity: 0.35 };
  const tireMat = { color: "#111", metalness: 0.2, roughness: 0.9 };
  const rimMat = { color: "#cccccc", metalness: 0.95, roughness: 0.05 };

  const wheelPositions: [number, number, number][] = [
    [-0.93, -0.24, 1.35],
    [0.93, -0.24, 1.35],
    [-0.93, -0.24, -1.3],
    [0.93, -0.24, -1.3],
  ];

  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[1.82, 0.42, 4.3]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Cabin */}
      <mesh castShadow position={[0, 0.43, -0.18]}>
        <boxGeometry args={[1.48, 0.44, 2.1]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Windshield */}
      <mesh position={[0, 0.4, 0.86]}>
        <boxGeometry args={[1.28, 0.36, 0.07]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>

      {/* Rear window */}
      <mesh position={[0, 0.4, -1.22]}>
        <boxGeometry args={[1.28, 0.36, 0.07]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>

      {/* Side windows left */}
      <mesh position={[-0.75, 0.41, -0.18]}>
        <boxGeometry args={[0.07, 0.3, 1.3]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>

      {/* Side windows right */}
      <mesh position={[0.75, 0.41, -0.18]}>
        <boxGeometry args={[0.07, 0.3, 1.3]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>

      {/* Front bumper */}
      <mesh position={[0, -0.1, 2.18]}>
        <boxGeometry args={[1.6, 0.22, 0.1]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>

      {/* Rear bumper */}
      <mesh position={[0, -0.1, -2.18]}>
        <boxGeometry args={[1.6, 0.22, 0.1]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>

      {/* Front grille */}
      <mesh position={[0, 0.06, 2.18]}>
        <boxGeometry args={[0.9, 0.16, 0.06]} />
        <meshStandardMaterial color="#0a0e14" metalness={0.3} roughness={0.8} />
      </mesh>

      {/* Headlights */}
      <mesh position={[0.56, 0.04, 2.16]}>
        <boxGeometry args={[0.38, 0.15, 0.06]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
      </mesh>
      <mesh position={[-0.56, 0.04, 2.16]}>
        <boxGeometry args={[0.38, 0.15, 0.06]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
      </mesh>

      {/* Taillights */}
      <mesh position={[0.56, 0.04, -2.16]}>
        <boxGeometry args={[0.38, 0.15, 0.06]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff1100" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[-0.56, 0.04, -2.16]}>
        <boxGeometry args={[0.38, 0.15, 0.06]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff1100" emissiveIntensity={2.5} />
      </mesh>

      {/* DRL strip front */}
      <mesh position={[0, 0.18, 2.17]}>
        <boxGeometry args={[1.4, 0.04, 0.04]} />
        <meshStandardMaterial color="#ff6a13" emissive="#ff6a13" emissiveIntensity={2} />
      </mesh>

      {/* Wheels */}
      {wheelPositions.map((pos, i) => (
        <group
          key={i}
          position={pos}
          ref={(el) => {
            if (el) wheelsRef.current[i] = el;
          }}
        >
          {/* Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.27, 0.27, 0.2, 20]} />
            <meshStandardMaterial {...tireMat} />
          </mesh>
          {/* Rim outer */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.22, 8]} />
            <meshStandardMaterial {...rimMat} />
          </mesh>
          {/* Rim spokes — 4 boxes */}
          {[0, 1, 2, 3].map((j) => (
            <mesh
              key={j}
              rotation={[j * (Math.PI / 4), 0, Math.PI / 2]}
            >
              <boxGeometry args={[0.04, 0.24, 0.04]} />
              <meshStandardMaterial {...rimMat} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Underbody */}
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[1.5, 0.06, 3.8]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>

      {/* Spoiler */}
      <mesh position={[0, 0.26, -2.14]}>
        <boxGeometry args={[1.4, 0.06, 0.28]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
    </group>
  );
}

function Road() {
  const dashGroupRef = useRef<THREE.Group>(null);
  const DASH_SPACING = 8;
  const DASH_COUNT = 30;

  useFrame(() => {
    if (!dashGroupRef.current) return;
    dashGroupRef.current.position.z += 0.22;
    if (dashGroupRef.current.position.z > DASH_SPACING) {
      dashGroupRef.current.position.z -= DASH_SPACING;
    }
  });

  return (
    <group>
      {/* Road surface */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <planeGeometry args={[9, 300]} />
        <meshStandardMaterial color="#111418" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Kerb lines left */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.6, -0.215, 0]}>
        <planeGeometry args={[0.5, 300]} />
        <meshStandardMaterial color="#c8102e" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.1, -0.214, 0]}>
        <planeGeometry args={[0.1, 300]} />
        <meshStandardMaterial color="white" roughness={0.7} />
      </mesh>

      {/* Kerb lines right */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.6, -0.215, 0]}>
        <planeGeometry args={[0.5, 300]} />
        <meshStandardMaterial color="#c8102e" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.1, -0.214, 0]}>
        <planeGeometry args={[0.1, 300]} />
        <meshStandardMaterial color="white" roughness={0.7} />
      </mesh>

      {/* Scrolling center dashes */}
      <group ref={dashGroupRef}>
        {Array.from({ length: DASH_COUNT }, (_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.213, -i * DASH_SPACING]}
          >
            <planeGeometry args={[0.12, 3.5]} />
            <meshStandardMaterial color="#f5c518" emissive="#f5c518" emissiveIntensity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Road reflections (wet road shine) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.219, 5]}>
        <planeGeometry args={[9, 20]} />
        <meshStandardMaterial color="#1a2a2a" metalness={0.6} roughness={0.3} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Lights() {
  const tailRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!tailRef.current) return;
    tailRef.current.intensity = 2.5 + Math.sin(state.clock.elapsedTime * 12) * 0.3;
  });

  return (
    <>
      <ambientLight intensity={0.08} color="#ff6a13" />
      <directionalLight position={[-6, 10, 4]} intensity={0.6} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} />
      {/* Orange accent undercar glow */}
      <pointLight position={[0, -0.15, 0]} intensity={4} color="#ff6a13" distance={3} />
      {/* Headlight spots */}
      <spotLight position={[0.56, 0.5, 2.5]} target-position={[0.4, -0.3, 25]} angle={0.12} penumbra={0.4} intensity={40} color="#ffffee" distance={30} castShadow />
      <spotLight position={[-0.56, 0.5, 2.5]} target-position={[-0.4, -0.3, 25]} angle={0.12} penumbra={0.4} intensity={40} color="#ffffee" distance={30} castShadow />
      {/* Taillight glow */}
      <pointLight ref={tailRef} position={[0, 0.1, -2.4]} intensity={2.5} color="#ff1100" distance={4} />
    </>
  );
}

function CameraRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame((state) => {
    if (!camRef.current) return;
    const t = state.clock.elapsedTime;
    camRef.current.position.x = Math.sin(t * 0.25) * 0.15;
    camRef.current.position.y = 2.2 + Math.sin(t * 9) * 0.01;
  });

  return <PerspectiveCamera ref={camRef} makeDefault position={[0, 2.2, 7.5]} fov={52} />;
}

function Scene() {
  return (
    <>
      <CameraRig />
      <fog attach="fog" args={["#050a0a", 18, 70]} />
      <Lights />
      <Car />
      <Road />
      {/* Distant glow on horizon */}
      <mesh position={[0, 3, -60]}>
        <planeGeometry args={[80, 8]} />
        <meshStandardMaterial color="#ff6a13" emissive="#ff6a13" emissiveIntensity={0.15} transparent opacity={0.12} />
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

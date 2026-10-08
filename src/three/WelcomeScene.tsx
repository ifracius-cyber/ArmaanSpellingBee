import { createContext, useContext, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Bee } from './Bee'
import { letterTexture } from './letterTexture'

/**
 * The welcome-after-sign-in motion graphic. Everything is timed off one clock so the whole
 * sequence finishes inside 5 seconds:
 *   0.0–1.6s  honeycomb cells swarm in from all sides and lock into a ring
 *   0.9–2.6s  the learner's name drops in as golden letter tiles
 *   2.4s      a confetti burst, and the bee does a lap of honour
 *   ~4.3s     the parent overlay fades out (handled in CSS)
 */

const RING = 54
const TimeOffset = createContext(0)
const RING_R = 4.6
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)
const easeBack = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  const c = 1.7
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

function HoneyRing() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cells = useMemo(
    () =>
      Array.from({ length: RING }, (_, i) => {
        const ring = i < 30 ? 0 : 1
        const n = ring ? RING - 30 : 30
        const k = ring ? i - 30 : i
        const a = (k / n) * Math.PI * 2 + ring * 0.1
        const r = ring ? RING_R + 1 : RING_R
        const from = new THREE.Vector3().setFromSphericalCoords(
          18 + (i % 7),
          Math.acos(((i * 37) % 100) / 50 - 1),
          i * 2.4,
        )
        return {
          to: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -1 - ring),
          from,
          delay: (i % 12) * 0.05,
        }
      }),
    [],
  )
  const colors = useMemo(() => {
    const arr = new Float32Array(RING * 3)
    const c = new THREE.Color()
    for (let i = 0; i < RING; i++) c.set(i % 4 === 0 ? '#fde68a' : i % 3 ? '#f59e0b' : '#b45309').toArray(arr, i * 3)
    return arr
  }, [])
  const off = useContext(TimeOffset)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + off
    const m = mesh.current
    if (!m) return
    cells.forEach((cell, i) => {
      const p = easeOut((t - cell.delay) / 1.4)
      dummy.position.lerpVectors(cell.from, cell.to, p)
      dummy.position.y += Math.sin(t * 2 + i) * 0.05 * p
      dummy.rotation.set(Math.PI / 2 + (1 - p) * 6, (1 - p) * 4 + t * 0.2, 0)
      dummy.scale.setScalar(0.42 + 0.08 * Math.sin(t * 3 + i))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.rotation.z = t * 0.12
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, RING]}>
      <cylinderGeometry args={[1, 1, 0.35, 6]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </cylinderGeometry>
      <meshStandardMaterial vertexColors roughness={0.3} metalness={0.2} />
    </instancedMesh>
  )
}

function NameTile({ ch, x, delay }: { ch: string; x: number; delay: number }) {
  const g = useRef<THREE.Group>(null)
  const tex = useMemo(() => letterTexture(ch), [ch])
  const off = useContext(TimeOffset)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.getElapsedTime() + off
    const p = easeBack((t - delay) / 0.55)
    g.current.position.set(x, (1 - p) * 6 + Math.sin(t * 2.4 + x) * 0.06 * p, 0)
    g.current.rotation.set((1 - p) * Math.PI * 2, 0, 0)
    g.current.scale.setScalar(Math.max(0.001, Math.min(p, 1.2)))
  })
  return (
    <group ref={g} position={[x, 6, 0]} scale={0.001}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.24, 6]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.125]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

const CONFETTI = 120

function Burst({ at }: { at: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const parts = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => {
        const a = (i / CONFETTI) * Math.PI * 2
        const s = 4 + ((i * 53) % 40) / 8
        return {
          v: new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s * 0.8 + 3, ((i % 9) - 4) * 0.4),
          spin: ((i % 11) - 5) * 1.5,
        }
      }),
    [],
  )
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFETTI * 3)
    const pal = ['#fbbf24', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fde68a'].map((c) => new THREE.Color(c))
    for (let i = 0; i < CONFETTI; i++) pal[i % pal.length].toArray(arr, i * 3)
    return arr
  }, [])
  const off = useContext(TimeOffset)
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.getElapsedTime() + off - at
    m.visible = t > 0
    if (t <= 0) return
    parts.forEach((p, i) => {
      dummy.position.set(p.v.x * t, p.v.y * t - 4.9 * t * t, p.v.z * t)
      dummy.rotation.set(t * p.spin, t * p.spin * 0.7, 0)
      dummy.scale.setScalar(0.14)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]} visible={false}>
      <cylinderGeometry args={[1, 1, 0.2, 6]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </cylinderGeometry>
      <meshStandardMaterial vertexColors roughness={0.4} />
    </instancedMesh>
  )
}

/** Bee that swoops in from off-screen and loops around the name. */
function SwoopingBee() {
  const g = useRef<THREE.Group>(null)
  const off = useContext(TimeOffset)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.getElapsedTime() + off
    const p = easeOut((t - 0.4) / 1.6)
    g.current.position.set(-12 * (1 - p), 2.6 * (1 - p) + 0.4, 0)
  })
  return (
    <group ref={g} position={[-12, 3, 0]}>
      <Bee radius={3.6} speed={1.1} scale={0.7} position={[0, 0.6, 1]} excited />
    </group>
  )
}

/** Shrinks the whole scene on narrow (phone) screens so the ring and name always fit. */
function FitToScreen({ halfWidth, children }: { halfWidth: number; children: React.ReactNode }) {
  const { viewport } = useThree()
  const scale = Math.min(1, viewport.width / 2 / halfWidth)
  return <group scale={scale}>{children}</group>
}

/** `at` skips ahead in the timeline (seconds) — handy for previewing a single frame. */
export default function WelcomeScene({ name, at = 0 }: { name: string; at?: number }) {
  const letters = [...(name.trim() || 'Speller').slice(0, 8)]
  const gap = 1.18
  const width = (letters.length - 1) * gap
  return (
    <Canvas camera={{ position: [0, 0, 13], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
      <TimeOffset.Provider value={at}>
        <FitToScreen halfWidth={Math.max(RING_R + 1.8, width / 2 + 1.2)}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 6]} intensity={1.8} color="#fff7e0" />
          <pointLight position={[-5, -2, 4]} intensity={30} color="#a78bfa" />
          <HoneyRing />
          <group position={[0, 0.3, 0.5]}>
            {letters.map((ch, i) => (
              <NameTile key={i} ch={ch} x={i * gap - width / 2} delay={0.9 + i * 0.12} />
            ))}
          </group>
          <Burst at={2.4} />
          <SwoopingBee />
        </FitToScreen>
      </TimeOffset.Provider>
    </Canvas>
  )
}

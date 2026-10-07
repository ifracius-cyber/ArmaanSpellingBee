import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Bee } from './Bee'

const COLS = 26
const ROWS = 16
const R = 0.5 // hex radius

/** A gently rippling honeycomb floor, built as one InstancedMesh for performance. */
function Honeycomb() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cells = useMemo(() => {
    const out: { x: number; z: number; d: number; honey: boolean }[] = []
    const w = Math.sqrt(3) * R
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - COLS / 2) * w + (r % 2 ? w / 2 : 0)
        const z = (r - ROWS / 2) * R * 1.5
        out.push({ x, z, d: Math.hypot(x, z), honey: Math.random() < 0.18 })
      }
    }
    return out
  }, [])

  const colors = useMemo(() => {
    const arr = new Float32Array(cells.length * 3)
    const a = new THREE.Color('#f59e0b')
    const b = new THREE.Color('#78350f')
    const tmp = new THREE.Color()
    cells.forEach((cell, i) => {
      tmp.copy(cell.honey ? a : b).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08)
      tmp.toArray(arr, i * 3)
    })
    return arr
  }, [cells])

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime()
    const m = mesh.current
    if (!m) return
    cells.forEach((cell, i) => {
      const wave = Math.sin(cell.d * 0.9 - t * 1.2) * 0.25 + Math.sin(cell.x * 0.4 + t * 0.6) * 0.1
      dummy.position.set(cell.x, wave, cell.z)
      dummy.scale.set(0.94, 1 + (cell.honey ? 0.6 : 0) + wave, 0.94)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.rotation.y = pointer.x * 0.08
    m.rotation.x = pointer.y * 0.04
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]} position={[0, -3.2, -4]}>
      <cylinderGeometry args={[R, R, 0.4, 6]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </cylinderGeometry>
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.15} />
    </instancedMesh>
  )
}

/** Floating golden pollen specks. */
function Pollen({ count = 220 }: { count?: number }) {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 24
      p[i * 3 + 1] = (Math.random() - 0.5) * 12
      p[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2
    }
    return p
  }, [count])
  useFrame((_, dt) => {
    if (!points.current) return
    points.current.rotation.y += dt * 0.02
    points.current.position.y = Math.sin(performance.now() / 4000) * 0.3
  })
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#fde68a" transparent opacity={0.8} sizeAttenuation />
    </points>
  )
}

export default function HiveBackground({ excited = false }: { excited?: boolean }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="fixed inset-0 -z-10" aria-hidden>
      <Canvas
        camera={{ position: [0, 1.2, 8], fov: 50 }}
        dpr={[1, 1.5]}
        frameloop={reduced ? 'demand' : 'always'}
        gl={{ antialias: true, powerPreference: 'low-power' }}
      >
        <color attach="background" args={['#14102e']} />
        <fog attach="fog" args={['#14102e', 8, 22]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={1.6} color="#fff7e0" />
        <pointLight position={[-6, 2, 2]} intensity={20} color="#a78bfa" />
        <Honeycomb />
        <Pollen />
        <Bee radius={4.2} speed={0.3} scale={0.55} position={[0, 1.6, -1]} excited={excited} />
      </Canvas>
    </div>
  )
}

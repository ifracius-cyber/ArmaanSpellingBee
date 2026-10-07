import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 140
const PALETTE = ['#fbbf24', '#f59e0b', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa']

function Burst() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, () => {
        const a = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 5
        return {
          p: new THREE.Vector3(0, -0.5, 0),
          v: new THREE.Vector3(Math.cos(a) * speed * 0.7, 4 + Math.random() * 6, Math.sin(a) * speed * 0.4),
          r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
          spin: (Math.random() - 0.5) * 12,
          s: 0.08 + Math.random() * 0.12,
        }
      }),
    [],
  )
  const colors = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    const c = new THREE.Color()
    for (let i = 0; i < COUNT; i++) c.set(PALETTE[i % PALETTE.length]).toArray(arr, i * 3)
    return arr
  }, [])

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const d = Math.min(dt, 0.05)
    parts.forEach((pt, i) => {
      pt.v.y -= 9.8 * d
      pt.v.multiplyScalar(0.985)
      pt.p.addScaledVector(pt.v, d)
      pt.r.x += pt.spin * d
      pt.r.y += pt.spin * 0.7 * d
      dummy.position.copy(pt.p)
      dummy.rotation.copy(pt.r)
      dummy.scale.setScalar(pt.s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <cylinderGeometry args={[1, 1, 0.25, 6]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </cylinderGeometry>
      <meshStandardMaterial vertexColors roughness={0.4} />
    </instancedMesh>
  )
}

/** Full-screen burst of honeycomb confetti. Change `burstKey` to fire again. */
export default function Confetti({ burstKey }: { burstKey: number }) {
  if (!burstKey) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      <Canvas key={burstKey} camera={{ position: [0, 0, 10], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 5]} intensity={1.5} />
        <Burst />
      </Canvas>
    </div>
  )
}

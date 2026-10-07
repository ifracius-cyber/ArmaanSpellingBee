import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BeeProps {
  /** Path radius; the bee loops around in a lazy figure-eight. */
  radius?: number
  speed?: number
  scale?: number
  position?: [number, number, number]
  /** When true the bee does a happy spin. */
  excited?: boolean
}

/** A friendly cartoon bee built from primitives, so no model files need loading. */
export function Bee({ radius = 3, speed = 0.35, scale = 1, position = [0, 0, 0], excited = false }: BeeProps) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  const prev = useRef(new THREE.Vector3())

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed
    const g = group.current
    if (!g || !body.current) return
    const x = Math.sin(t) * radius
    const y = Math.sin(t * 2) * radius * 0.25 + Math.sin(clock.getElapsedTime() * 3) * 0.08
    const z = Math.cos(t) * radius * 0.4
    g.position.set(position[0] + x, position[1] + y, position[2] + z)
    // face the direction of travel
    const dx = g.position.x - prev.current.x
    const dz = g.position.z - prev.current.z
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) body.current.rotation.y = Math.atan2(dx, dz) - Math.PI / 2
    prev.current.copy(g.position)
    body.current.rotation.z = excited ? clock.getElapsedTime() * 8 : Math.sin(clock.getElapsedTime() * 2) * 0.1
    const flap = Math.sin(clock.getElapsedTime() * 40) * 0.6
    if (wingL.current) wingL.current.rotation.x = 0.4 + flap
    if (wingR.current) wingR.current.rotation.x = -0.4 - flap
  })

  return (
    <group ref={group} scale={scale}>
      <group ref={body}>
        {/* body */}
        <mesh scale={[1.25, 0.9, 0.9]}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="#facc15" roughness={0.4} />
        </mesh>
        {/* stripes */}
        {[-0.18, 0.12].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]}>
            <cylinderGeometry args={[0.455, 0.455, 0.12, 32]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} />
          </mesh>
        ))}
        {/* stinger */}
        <mesh position={[-0.68, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.08, 0.2, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* head */}
        <mesh position={[0.62, 0.08, 0]}>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial color="#fde047" roughness={0.4} />
        </mesh>
        {/* eyes */}
        {[0.13, -0.13].map((z) => (
          <group key={z} position={[0.86, 0.16, z]}>
            <mesh>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshStandardMaterial color="white" />
            </mesh>
            <mesh position={[0.05, 0.01, 0]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        ))}
        {/* smile */}
        <mesh position={[0.9, -0.02, 0]} rotation={[0, Math.PI / 2, Math.PI]}>
          <torusGeometry args={[0.08, 0.018, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#7c2d12" />
        </mesh>
        {/* antennae */}
        {[0.1, -0.1].map((z) => (
          <group key={z} position={[0.72, 0.36, z]} rotation={[z * 3, 0, -0.4]}>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.25]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0, 0.26, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
        ))}
        {/* wings */}
        <mesh ref={wingL} position={[0.05, 0.42, 0.18]}>
          <sphereGeometry args={[0.3, 24, 16]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.55} roughness={0.1} transmission={0.4} />
        </mesh>
        <mesh ref={wingR} position={[0.05, 0.42, -0.18]}>
          <sphereGeometry args={[0.3, 24, 16]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.55} roughness={0.1} transmission={0.4} />
        </mesh>
      </group>
    </group>
  )
}

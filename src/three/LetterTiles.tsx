import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { letterTexture } from './letterTexture'

export type TileState = 'neutral' | 'correct' | 'wrong' | 'missing'

const TILE_COLORS: Record<TileState, string> = {
  neutral: '#fbbf24',
  correct: '#4ade80',
  wrong: '#f87171',
  missing: '#c4b5fd',
}

interface TileProps {
  ch: string
  index: number
  x: number
  revealed: boolean
  state: TileState
  active: boolean
}

function Tile({ ch, index, x, revealed, state, active }: TileProps) {
  const group = useRef<THREE.Group>(null)
  const tex = useMemo(() => letterTexture(ch), [ch])
  const shown = useRef(0)

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    shown.current = THREE.MathUtils.damp(shown.current, revealed ? 1 : 0, 7, dt)
    const s = shown.current
    // flip in from face-down, drop from above
    g.rotation.x = (1 - s) * Math.PI
    g.position.y = (1 - s) * 1.5 + Math.sin(clock.getElapsedTime() * 2 + index * 0.6) * 0.06 + (active ? 0.25 : 0)
    const scale = 0.6 + s * 0.4 + (active ? 0.12 : 0)
    g.scale.setScalar(scale)
  })

  return (
    <group ref={group} position={[x, 0, 0]}>
      {/* hexagonal tile, rotated so its flat face points at the camera */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.22, 6]} />
        <meshStandardMaterial color={TILE_COLORS[state]} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
      {/* back face: honeycomb dot */}
      <mesh position={[0, 0, -0.115]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.18, 6]} />
        <meshBasicMaterial color="#92400e" />
      </mesh>
    </group>
  )
}

/** Keeps the whole word in view, however long it is. */
function FitCamera({ width }: { width: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const fov = (cam.fov * Math.PI) / 180
    const distForWidth = (width / 2 + 0.6) / (Math.tan(fov / 2) * aspect)
    cam.position.z = Math.max(3.2, distForWidth)
    cam.updateProjectionMatrix()
  }, [camera, size, width])
  return null
}

interface LetterTilesProps {
  word: string
  /** How many letters are face-up. Defaults to all. */
  revealCount?: number
  states?: TileState[]
  activeIndex?: number
  height?: number
}

/** A row of 3D honeycomb tiles that flip over to reveal a word's letters. */
export default function LetterTiles({ word, revealCount, states, activeIndex = -1, height = 150 }: LetterTilesProps) {
  const chars = useMemo(() => [...word], [word])
  const gap = 1.08
  const width = (chars.length - 1) * gap
  const shown = revealCount ?? chars.length
  return (
    <div style={{ height }} className="w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 40 }} dpr={[1, 2]}>
        <FitCamera width={width} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 5]} intensity={1.6} />
        <group position={[0, -0.1, 0]}>
          {chars.map((ch, i) => (
            <Tile
              key={`${word}-${i}`}
              ch={ch}
              index={i}
              x={i * gap - width / 2}
              revealed={i < shown}
              state={states?.[i] ?? 'neutral'}
              active={i === activeIndex}
            />
          ))}
        </group>
      </Canvas>
    </div>
  )
}

/** Steps through the letters one at a time — handy for "spell it to me" playback. */
export function useLetterReveal(word: string, intervalMs: number) {
  const [count, setCount] = useState(word.length)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    setCount(word.length)
    setPlaying(false)
  }, [word])
  useEffect(() => {
    if (!playing) return
    if (count >= word.length) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setCount((c) => c + 1), intervalMs)
    return () => clearTimeout(t)
  }, [playing, count, word, intervalMs])
  const start = () => {
    setCount(0)
    setPlaying(true)
  }
  return { count, playing, start }
}

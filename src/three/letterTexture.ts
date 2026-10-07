import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

/** Draws a single character onto a canvas texture (no external font files needed). */
export function letterTexture(ch: string, color = '#1e1b4b'): THREE.CanvasTexture {
  const key = `${ch}|${color}`
  const hit = cache.get(key)
  if (hit) return hit
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = ch === ' ' ? '␣' : ch
  ctx.font = `700 ${label.length > 1 ? 120 : 170}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`
  ctx.fillText(label, size / 2, size / 2 + 10)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}

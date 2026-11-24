import { NIVEL } from './fisica.ts'
import { cadaCuadro, sinMovimiento } from './resortes.ts'

// Chispas: tuercas chicas (o fichas, para la plata) que saltan desde un punto al terminar algo. Se dibujan en una capa
// que no recibe toques, encima de todo. Los colores salen del modo de la pantalla (acento, cinta y tinta).

type Chispa = { x: number; y: number; vx: number; vy: number; r: number; vr: number; t: number; vida: number; tam: number; color: string; forma: 'tuerca' | 'ficha' }

export type OpcionesChispas = {
  // Cuántas, como fracción de las de siempre (1 = NIVEL.chispas)
  cantidad?: number
  colores?: string[]
  forma?: 'tuerca' | 'ficha'
  // Hacia dónde salen (radianes; -π/2 es hacia arriba) y qué tan abierto (2π = en todas direcciones)
  angulo?: number
  abanico?: number
  velocidad?: number
  tamano?: number
}

const vivas: Chispa[] = []
let lienzo: HTMLCanvasElement | null = null
let pincel: CanvasRenderingContext2D | null = null
let densidad = 1
let quitar: (() => void) | null = null

function medir() {
  if (!lienzo) return
  densidad = Math.min(2, window.devicePixelRatio || 1)
  lienzo.width = Math.round(window.innerWidth * densidad)
  lienzo.height = Math.round(window.innerHeight * densidad)
}

function prepararLienzo() {
  if (lienzo) return
  lienzo = document.createElement('canvas')
  lienzo.setAttribute('aria-hidden', 'true')
  Object.assign(lienzo.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' })
  document.body.append(lienzo)
  pincel = lienzo.getContext('2d')
  medir()
  window.addEventListener('resize', medir)
}

function coloresDelTema(): string[] {
  const estilo = getComputedStyle(document.documentElement)
  return ['--acento', '--cinta', '--tinta'].map((v) => estilo.getPropertyValue(v).trim() || '#3fa9f5')
}

export function chispas(x: number, y: number, o: OpcionesChispas = {}) {
  if (sinMovimiento() || typeof document === 'undefined') return
  const cuantas = Math.round((o.cantidad ?? 1) * NIVEL.chispas)
  if (!cuantas) return
  prepararLienzo()
  const colores = o.colores ?? coloresDelTema()
  for (let i = 0; i < cuantas; i++) {
    const a = (o.angulo ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.abanico ?? Math.PI * 2)
    const v = (o.velocidad ?? 300) * (0.4 + Math.random() * 0.8)
    vivas.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 16,
      t: 0,
      vida: 0.55 + Math.random() * 0.5,
      tam: (o.tamano ?? 4.5) * (0.7 + Math.random() * 0.7),
      color: colores[i % colores.length],
      forma: o.forma ?? 'tuerca',
    })
  }
  if (!quitar) quitar = cadaCuadro(dibujar)
}

// Chispas desde el centro de un elemento
export function chispasDesde(el: Element | null | undefined, o: OpcionesChispas = {}) {
  if (!el) return
  const r = el.getBoundingClientRect()
  chispas(r.left + r.width / 2, r.top + r.height / 2, o)
}

function dibujar(dt: number) {
  if (!lienzo || !pincel) return
  pincel.setTransform(densidad, 0, 0, densidad, 0, 0)
  pincel.clearRect(0, 0, lienzo.width, lienzo.height)
  for (let i = vivas.length - 1; i >= 0; i--) {
    const c = vivas[i]
    c.t += dt
    if (c.t >= c.vida) {
      vivas.splice(i, 1)
      continue
    }
    c.vy += 1000 * dt
    c.vx *= Math.exp(-1.6 * dt)
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.r += c.vr * dt
    const queda = 1 - c.t / c.vida
    const tam = c.tam * (0.55 + 0.45 * queda)
    pincel.globalAlpha = Math.min(1, queda * 1.8)
    pincel.fillStyle = c.color
    pincel.save()
    pincel.translate(c.x, c.y)
    pincel.rotate(c.r)
    pincel.beginPath()
    if (c.forma === 'ficha') {
      pincel.arc(0, 0, tam, 0, Math.PI * 2)
      pincel.arc(0, 0, tam * 0.5, 0, Math.PI * 2, true)
    } else {
      // Una tuerca: hexágono con agujero
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3
        if (j === 0) pincel.moveTo(Math.cos(a) * tam, Math.sin(a) * tam)
        else pincel.lineTo(Math.cos(a) * tam, Math.sin(a) * tam)
      }
      pincel.closePath()
      pincel.moveTo(tam * 0.42, 0)
      pincel.arc(0, 0, tam * 0.42, 0, Math.PI * 2, true)
    }
    pincel.fill('evenodd')
    pincel.restore()
  }
  pincel.globalAlpha = 1
  if (!vivas.length) {
    pincel.setTransform(1, 0, 0, 1, 0, 0)
    pincel.clearRect(0, 0, lienzo.width, lienzo.height)
    quitar?.()
    quitar = null
  }
}

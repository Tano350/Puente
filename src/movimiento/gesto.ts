import { suavizar } from './fisica.ts'

// Seguir un gesto (arrastrar, deslizar, girar) con el dedo o el mouse, desde un pointerdown.
//
// - eje "x" espera un movimiento de lado: si el dedo va hacia arriba o abajo, gana el desplazamiento de la pantalla
//   y el gesto no empieza. "y" es al revés. "libre" empieza con cualquier movimiento.
// - mantener: en pantallas táctiles hay que dejar el dedo quieto esos ms antes de mover (así desplazar la lista nunca
//   levanta nada). Con el mouse basta moverlo unos pixeles.
// - Mientras el gesto está en curso, la pantalla no se desplaza y el clic que lo cierra no cuenta como toque.
// - A los elementos que se arrastran se les pone data-arrastrable (base.css): sin selección de texto ni menú al
//   mantener apretado.

export type Puntero = {
  x: number
  y: number
  x0: number
  y0: number
  dx: number
  dy: number
  // Velocidad en pixeles por segundo, suavizada
  vx: number
  vy: number
  tactil: boolean
}

export type OpcionesGesto = {
  eje?: 'x' | 'y' | 'libre'
  // Solo hacia ese lado del eje (1: derecha o abajo; -1: izquierda o arriba). Hacia el otro, el gesto no empieza.
  sentido?: 1 | -1
  mantener?: number
  umbral?: number
  // Devuelve false si no se puede (por ejemplo, sin permiso): el gesto no empieza y al soltar ese toque no abre nada
  alEmpezar?: (p: Puntero) => boolean | void
  alMover?: (p: Puntero) => void
  alSoltar?: (p: Puntero, cancelado: boolean) => void
  // Se tocó sin mover (solo si no empezó)
  alTocar?: () => void
}

type Oyentes = { mover: (e: PointerEvent) => void; soltar: (e: PointerEvent) => void; tocarMover: (e: TouchEvent) => void; menu: (e: Event) => void }

let enCurso: { id: number; oyentes: Oyentes; reloj?: number } | null = null
let suprimirHasta = 0
const oyentesDeApretar = new Set<() => void>()

// Lo que se aprieta deja de verse apretado cuando empieza un gesto (apretar.ts se anota aquí)
export function alEmpezarGesto(f: () => void) {
  oyentesDeApretar.add(f)
}

export function hayGesto(): boolean {
  return enCurso !== null
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (suprimirHasta = 0), true)
  window.addEventListener(
    'click',
    (e) => {
      if (performance.now() >= suprimirHasta) return
      suprimirHasta = 0
      e.stopPropagation()
      e.preventDefault()
    },
    true,
  )
}

function suprimirClic() {
  suprimirHasta = performance.now() + 600
}

export function seguir(evento: PointerEvent | { nativeEvent: PointerEvent }, o: OpcionesGesto) {
  const e = 'nativeEvent' in evento ? evento.nativeEvent : evento
  if (enCurso || e.button > 0) return
  const tactil = e.pointerType !== 'mouse'
  const eje = o.eje ?? 'libre'
  const umbral = o.umbral ?? 6
  const esperar = tactil && o.mantener ? o.mantener : 0
  const p: Puntero = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, vx: 0, vy: 0, tactil }
  let activo = false
  // No se pudo (alEmpezar dijo que no): se espera a que suelte para que ese toque no abra nada
  let rechazado = false
  let listoParaMover = esperar === 0
  let ultimo = performance.now()

  const terminar = () => {
    if (!enCurso) return
    window.clearTimeout(enCurso.reloj)
    window.removeEventListener('pointermove', oyentes.mover)
    window.removeEventListener('pointerup', oyentes.soltar)
    window.removeEventListener('pointercancel', oyentes.soltar)
    document.removeEventListener('touchmove', oyentes.tocarMover)
    document.removeEventListener('contextmenu', oyentes.menu, true)
    enCurso = null
  }

  const empezar = () => {
    if (o.alEmpezar?.(p) === false) {
      rechazado = true
      return
    }
    activo = true
    suprimirClic()
    for (const f of oyentesDeApretar) f()
    o.alMover?.(p)
  }

  const oyentes: Oyentes = {
    mover: (m) => {
      if (m.pointerId !== e.pointerId) return
      const ahora = performance.now()
      const dt = Math.max(4, ahora - ultimo) / 1000
      p.vx = suavizar(p.vx, (m.clientX - p.x) / dt)
      p.vy = suavizar(p.vy, (m.clientY - p.y) / dt)
      p.x = m.clientX
      p.y = m.clientY
      p.dx = p.x - p.x0
      p.dy = p.y - p.y0
      ultimo = ahora
      if (rechazado) return
      if (activo) return o.alMover?.(p)
      const distancia = Math.hypot(p.dx, p.dy)
      // Esperando el toque largo: si el dedo se mueve antes, es un desplazamiento
      if (!listoParaMover) {
        if (distancia > 9) terminar()
        return
      }
      if (distancia < umbral) return
      if (eje === 'libre') return empezar()
      const [este, otro] = eje === 'x' ? [p.dx, p.dy] : [p.dy, p.dx]
      if (Math.abs(este) > Math.abs(otro) * 1.2 && (!o.sentido || Math.sign(este) === o.sentido)) return empezar()
      if (Math.abs(otro) >= umbral || (o.sentido && Math.sign(este) === -o.sentido)) terminar()
    },
    soltar: (s) => {
      if (s.pointerId !== e.pointerId) return
      const cancelado = s.type === 'pointercancel'
      // Si el dedo se quedó quieto antes de soltar, no hay impulso
      if (performance.now() - ultimo > 90) {
        p.vx = 0
        p.vy = 0
      }
      const estaba = activo
      terminar()
      // El clic que llega al soltar un gesto (aunque haya durado mucho) o un toque largo que no se pudo no cuenta
      if (estaba || rechazado) suprimirClic()
      if (estaba) o.alSoltar?.(p, cancelado)
      else if (!rechazado && !cancelado && Math.hypot(p.dx, p.dy) < umbral) o.alTocar?.()
    },
    // Con el gesto en curso, el dedo no desplaza la pantalla
    tocarMover: (t) => {
      if (activo && t.cancelable) t.preventDefault()
    },
    menu: (m) => m.preventDefault(),
  }

  enCurso = { id: e.pointerId, oyentes }
  window.addEventListener('pointermove', oyentes.mover)
  window.addEventListener('pointerup', oyentes.soltar)
  window.addEventListener('pointercancel', oyentes.soltar)
  document.addEventListener('touchmove', oyentes.tocarMover, { passive: false })
  document.addEventListener('contextmenu', oyentes.menu, true)
  if (esperar) {
    enCurso.reloj = window.setTimeout(() => {
      if (!enCurso || enCurso.id !== e.pointerId || activo) return
      listoParaMover = true
      empezar()
    }, esperar)
  }
}

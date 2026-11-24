import { useEffect, useRef, type PointerEvent as EventoPuntero, type ReactNode } from 'react'
import { Tuerca } from '../../componentes/Tuerca.tsx'
import { asentarGiro, cadaCuadro, cuerpo, empujon, NIVEL, seguir, sinMovimiento, sonar, vibrar, type Puntero } from '../../movimiento/index.ts'

// Un lado de la tuerca son 60°: cada vez que el giro pasa por uno suena el "trinquete"
const LADO = 60
// Bajo esta velocidad (°/s) la tuerca deja de girar sola y se asienta en un lado
const LENTA = 90

// La tuerca grande de Hoy: se gira con el dedo o el mouse, sigue girando al soltarla y se asienta en un lado.
// Solo gira el hexágono (el agujero es un círculo); la cuenta de adentro se queda derecha.
export function TuercaGira({ className, children }: { className: string; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  // La velocidad con que gira sola (°/s) y cómo se detiene
  const giro = useRef({ w: 0, quitar: null as null | (() => void) })
  useEffect(() => () => giro.current.quitar?.(), [])

  const hexagono = () => caja.current?.querySelector<SVGElement>('svg') ?? null
  const parar = () => {
    giro.current.quitar?.()
    giro.current.quitar = null
  }
  // Un lado cruzado: trinquete
  const diente = (antes: number, ahora: number, w: number) => {
    if (Math.floor(antes / LADO) === Math.floor(ahora / LADO)) return
    sonar('giro', Math.min(1, Math.abs(w) / 1500))
    vibrar(4)
  }
  const asentar = (w: number) => {
    const el = hexagono()
    if (!el) return
    const c = cuerpo(el)
    const r = c.p.r
    const meta = asentarGiro(r, w)
    c.fijar({ r })
    c.alQuieto = () => empujon(caja.current?.querySelector<HTMLElement>('[data-pop]'), { s: 1.2 })
    if (meta !== r) c.meta({ r: meta }).vel({ r: w })
    else c.alQuieto?.()
  }
  // Gira sola con roce hasta ir despacio
  const soltarGirando = (w0: number) => {
    const el = hexagono()
    if (!el) return
    if (sinMovimiento() || Math.abs(w0) < LENTA) return asentar(w0)
    parar()
    const c = cuerpo(el)
    giro.current.w = w0
    giro.current.quitar = cadaCuadro((dt) => {
      const antes = c.p.r
      giro.current.w *= Math.exp(-NIVEL.roce * dt)
      c.fijar({ r: antes + giro.current.w * dt })
      diente(antes, c.p.r, giro.current.w)
      if (Math.abs(giro.current.w) < LENTA) {
        parar()
        asentar(giro.current.w)
      }
    })
  }

  const empezar = (e: EventoPuntero) => {
    const el = hexagono()
    const area = caja.current
    if (!el || !area) return
    const c = cuerpo(el)
    const centro = () => {
      const r = area.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const angulo = (p: Puntero) => {
      const o = centro()
      return (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI
    }
    let ultimo = 0
    let w = 0
    seguir(e, {
      eje: 'libre',
      umbral: 4,
      alEmpezar: (p) => {
        // Si giraba sola, se la agarra donde va
        parar()
        c.alQuieto = null
        c.fijar({ r: c.p.r })
        ultimo = angulo(p)
        w = 0
      },
      alMover: (p) => {
        const a = angulo(p)
        // El cambio de ángulo, por el camino corto (así pasar de 180° a -180° no da una vuelta)
        let d = a - ultimo
        if (d > 180) d -= 360
        if (d < -180) d += 360
        ultimo = a
        const antes = c.p.r
        c.fijar({ r: antes + d })
        diente(antes, c.p.r, w)
        // La velocidad angular del dedo alrededor del centro (°/s)
        const o = centro()
        const rx = p.x - o.x
        const ry = p.y - o.y
        const radio2 = Math.max(400, rx * rx + ry * ry)
        w = (((rx * p.vy - ry * p.vx) / radio2) * 180) / Math.PI
      },
      alSoltar: (_p, cancelado) => (cancelado ? asentar(0) : soltarGirando(w)),
      // Un toque la hace girar
      alTocar: () => {
        const llevaba = giro.current.w
        parar()
        if (sinMovimiento()) {
          const antes = c.p.r
          c.fijar({ r: antes + LADO })
          diente(antes, c.p.r, NIVEL.giro)
          return
        }
        soltarGirando(llevaba + NIVEL.giro)
      },
    })
  }

  return (
    <div ref={caja} className={className} data-arrastrable onPointerDown={empezar}>
      <Tuerca ancho={104} />
      {children}
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero, type RefObject } from 'react'
import { cadaCuadro, chispasDesde, cuerpo, empujon, ladeo, NIVEL, sacudir, seguir, sinMovimiento, sonar, useFlip, vibrar, zonaBajo, type Puntero } from '../../movimiento/index.ts'

// Arrastrar un contacto a otro estado: la lista del celular (mantener apretado y llevar) y el tablero del computador
// (con el mouse basta moverlo unos pixeles). Mientras se arrastra:
// - una copia levantada (el "fantasma") sigue al dedo con un resorte y se ladea según la velocidad; el original queda
//   desvanecido en su lugar;
// - la zona de abajo ([data-zona="estado"]) se marca y abre su hueco ([data-hueco], el componente Hueco);
// - cerca del borde de arriba o de abajo, la lista se desplaza sola.
// Al soltar sobre otra zona, el fantasma vuela al hueco y recién ahí se guarda (alSoltar); el contacto aparece desde
// donde aterrizó. Soltar en otra parte lo devuelve a su lugar. Sin permiso, la fila tiembla y un aviso dice por qué.
//
// En cada fila o tarjeta: data-flip con la clave del contacto y, si la copia es solo una parte, data-fantasma en esa parte.

type Opciones<T> = {
  contenedor: RefObject<HTMLElement | null>
  // "filas": las zonas van una debajo de otra y cuenta la altura del dedo (lista). "punto": la zona bajo el puntero (tablero).
  zonas: 'filas' | 'punto'
  // Si la lista entera se reacomoda con useFlip (el tablero lo hace por columna)
  flip: boolean
  clave: (item: T) => string
  zonaDe: (item: T) => string
  puede: (item: T) => boolean
  alNoPoder: (item: T) => void
  alSoltar: (item: T, zona: string, el: HTMLElement) => void
  claseFantasma: string
  // Lo que se desplaza solo cuando el dedo llega al borde
  desplazable?: (zona: HTMLElement | null) => HTMLElement | null | undefined
}

type Curso<T> = {
  item: T
  fantasma: HTMLElement
  base: DOMRect
  x: number
  y: number
  vx: number
  ultimo: number
  resto: number
  zona: HTMLElement | null
  sobre: string | null
  soltado: boolean
  quitar: () => void
}

export function useArrastre<T>(o: Opciones<T>) {
  const [arrastrado, setArrastrado] = useState<T | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [alto, setAlto] = useState(0)
  const curso = useRef<Curso<T> | null>(null)
  const aterrizaje = useRef<{ clave: string; x: number; y: number } | null>(null)
  const ultimas = useRef(o)
  useLayoutEffect(() => {
    ultimas.current = o
  })
  const sinFlip = useRef<HTMLElement | null>(null)
  useFlip(o.flip ? o.contenedor : sinFlip)

  // Lo que se soltó aparece desde donde aterrizó el fantasma (después de useFlip, que lo movería desde su lugar viejo)
  useLayoutEffect(() => {
    const a = aterrizaje.current
    if (!a) return
    aterrizaje.current = null
    const el = ultimas.current.contenedor.current?.querySelector<HTMLElement>(`[data-flip="${CSS.escape(a.clave)}"]`)
    if (!el || sinMovimiento()) return
    const parte = el.querySelector<HTMLElement>('[data-fantasma]') ?? el
    const c = cuerpo(el)
    const r = parte.getBoundingClientRect()
    c.pos({ x: a.x - (r.left - c.p.x), y: a.y - (r.top - c.p.y) }).meta({ x: 0, y: 0 })
  })

  // Si la pantalla se va con algo levantado (por ejemplo, a Crear evento), el fantasma se va con ella
  useEffect(
    () => () => {
      curso.current?.quitar()
      curso.current?.fantasma.remove()
      curso.current = null
    },
    [],
  )

  const mirarZona = (k: Curso<T>) => {
    const op = ultimas.current
    const raiz = op.contenedor.current
    if (!raiz) return
    let el: HTMLElement | null = null
    if (op.zonas === 'filas') {
      const caja = op.desplazable?.(null)?.getBoundingClientRect()
      if (!caja || (k.y >= caja.top && k.y <= caja.bottom)) {
        const zonas = [...raiz.querySelectorAll<HTMLElement>('[data-zona]')]
        const i = zonaBajo(
          k.y,
          zonas.map((z) => {
            const r = z.getBoundingClientRect()
            return { arriba: r.top, abajo: r.bottom }
          }),
        )
        el = zonas[i] ?? null
      }
    } else {
      el = document.elementFromPoint(k.x, k.y)?.closest<HTMLElement>('[data-zona]') ?? null
      if (el && !raiz.contains(el)) el = null
    }
    const clave = el?.dataset.zona ?? null
    const acepta = clave !== null && clave !== op.zonaDe(k.item)
    k.zona = acepta ? el : null
    const nueva = acepta ? clave : null
    if (nueva !== k.sobre) {
      k.sobre = nueva
      setSobre(nueva)
      if (nueva) sonar('tick')
    }
  }

  // Cada cuadro: el ladeo se endereza cuando el dedo se queda quieto, y cerca del borde la lista se desplaza
  const cuadro = (dt: number) => {
    const k = curso.current
    if (!k || k.soltado) return
    if (performance.now() - k.ultimo > 50) {
      k.vx *= Math.exp(-9 * dt)
      cuerpo(k.fantasma).meta({ r: ladeo(k.vx, NIVEL.ladeo) })
    }
    const caja = ultimas.current.desplazable?.(k.zona)
    if (!caja) return
    const r = caja.getBoundingClientRect()
    const borde = Math.min(72, r.height / 4)
    let v = 0
    if (k.y < r.top + borde) v = -(r.top + borde - k.y) / borde
    else if (k.y > r.bottom - borde) v = (k.y - (r.bottom - borde)) / borde
    if (!v) return
    k.resto += Math.max(-1, Math.min(1, v)) * 750 * dt
    const paso = Math.trunc(k.resto)
    if (!paso) return
    k.resto -= paso
    const antes = caja.scrollTop
    caja.scrollTop += paso
    if (caja.scrollTop !== antes) mirarZona(k)
  }

  const levantar = (item: T, fila: HTMLElement, p: Puntero) => {
    const op = ultimas.current
    const parte = fila.querySelector<HTMLElement>('[data-fantasma]') ?? fila
    // Se mide sin el "apretado" (achicado alrededor del dedo)
    cuerpo(fila).fijar({ x: 0, y: 0, s: 1, r: 0 })
    const base = parte.getBoundingClientRect()
    const fantasma = parte.cloneNode(true) as HTMLElement
    fantasma.removeAttribute('data-flip')
    fantasma.removeAttribute('id')
    fantasma.setAttribute('aria-hidden', 'true')
    fantasma.inert = true
    fantasma.className = `${parte.className} ${op.claseFantasma}`
    fantasma.style.cssText = ''
    Object.assign(fantasma.style, {
      position: 'fixed',
      left: `${base.left}px`,
      top: `${base.top}px`,
      width: `${base.width}px`,
      height: `${base.height}px`,
      margin: '0',
      boxSizing: 'border-box',
      zIndex: '50',
      pointerEvents: 'none',
    })
    document.body.append(fantasma)
    const c = cuerpo(fantasma)
    // Sigue al dedo más firme que el resorte de siempre
    c.k = 1100
    c.c = 52
    c.meta({ s: NIVEL.levantar })
    const k: Curso<T> = { item, fantasma, base, x: p.x, y: p.y, vx: 0, ultimo: performance.now(), resto: 0, zona: null, sobre: null, soltado: false, quitar: () => {} }
    k.quitar = cadaCuadro(cuadro)
    curso.current = k
    setAlto(base.height)
    setArrastrado(item)
    setSobre(null)
    sonar('levantar')
    vibrar(6)
  }

  const mover = (p: Puntero) => {
    const k = curso.current
    if (!k || k.soltado) return
    k.x = p.x
    k.y = p.y
    k.vx = p.vx
    k.ultimo = performance.now()
    cuerpo(k.fantasma).meta({ x: p.dx, y: p.dy, r: ladeo(p.vx, NIVEL.ladeo) })
    mirarZona(k)
  }

  const terminar = (k: Curso<T>) => {
    k.fantasma.remove()
    if (curso.current === k) curso.current = null
    setArrastrado(null)
    setSobre(null)
  }

  const aterrizar = (k: Curso<T>, zona: string, el: HTMLElement) => {
    const r = k.fantasma.getBoundingClientRect()
    aterrizaje.current = { clave: ultimas.current.clave(k.item), x: r.left, y: r.top }
    terminar(k)
    ultimas.current.alSoltar(k.item, zona, el)
  }

  const soltar = (cancelado: boolean) => {
    const k = curso.current
    if (!k || k.soltado) return
    k.soltado = true
    k.quitar()
    const c = cuerpo(k.fantasma)
    c.k = null
    c.c = null
    const zona = cancelado ? null : k.zona
    const clave = zona?.dataset.zona
    const hueco = zona?.querySelector<HTMLElement>('[data-hueco]')
    if (zona && clave && hueco) {
      const h = hueco.getBoundingClientRect()
      // Si el hueco quedó fuera de la vista, aterriza en el borde
      const caja = ultimas.current.desplazable?.(zona)?.getBoundingClientRect()
      const y = caja ? Math.max(caja.top, Math.min(h.top, caja.bottom - k.base.height)) : h.top
      c.meta({ x: h.left - k.base.left, y: y - k.base.top, s: 1, r: 0 })
      c.alQuieto = () => aterrizar(k, clave, zona)
      return
    }
    k.sobre = null
    setSobre(null)
    c.meta({ x: 0, y: 0, s: 1, r: 0 })
    c.alQuieto = () => terminar(k)
  }

  // Desde el onPointerDown de la fila o la tarjeta
  const empezar = (e: EventoPuntero<HTMLElement>, item: T) => {
    const fila = e.currentTarget
    seguir(e, {
      eje: 'libre',
      mantener: NIVEL.mantener,
      alEmpezar: (p) => {
        // Otro todavía va volando a su lugar
        if (curso.current) return false
        if (!ultimas.current.puede(item)) {
          sacudir(fila)
          sonar('error')
          ultimas.current.alNoPoder(item)
          return false
        }
        levantar(item, fila, p)
      },
      alMover: mover,
      alSoltar: (_p, cancelado) => soltar(cancelado),
    })
  }

  return { arrastrado, sobre, alto, empezar }
}

// Después de soltar en otro estado: su tuerca da un paso, su cuenta salta y saltan chispas
export function festejar(zona: HTMLElement, { conChispas = true }: { conChispas?: boolean } = {}) {
  const tuerca = zona.querySelector<HTMLElement>('[data-tuerca]')
  if (tuerca && !sinMovimiento()) {
    const c = cuerpo(tuerca)
    c.meta({ r: c.m.r + 60 })
  }
  empujon(zona.querySelector<HTMLElement>('[data-cuenta]'), { s: 1.6 })
  if (conChispas) chispasDesde(tuerca, { cantidad: 0.5 })
  sonar('soltar')
  vibrar(8)
}

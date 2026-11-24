import { escalaSegunAncho, llego, NIVEL, PASO, pasoResorte } from './fisica.ts'

// El motor del movimiento: cada elemento que se mueve tiene un "cuerpo" con resortes (posición, giro, escala e
// inclinación) que van hacia su meta. Un solo ciclo por cuadro mueve todo y se apaga cuando nada se mueve.
//
// Escribe las propiedades translate, rotate y scale, que se suman al transform propio de cada elemento (no lo pisan).
// Solo la inclinación de las tarjetas usa transform (perspectiva), por eso va únicamente en [data-carta].
//
// Con "reducir movimiento" del teléfono nada se anima: lo que iba a moverse llega al tiro (los gestos siguen andando).

const consulta = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
let reducido = consulta?.matches ?? false
consulta?.addEventListener?.('change', (e) => {
  reducido = e.matches
})

export function sinMovimiento(): boolean {
  return reducido
}

type Prop = 'x' | 'y' | 'r' | 's' | 'rx' | 'ry'
export type Valores = Record<Prop, number>
const PROPS: Prop[] = ['x', 'y', 'r', 's', 'rx', 'ry']
const REPOSO: Valores = { x: 0, y: 0, r: 0, s: 1, rx: 0, ry: 0 }
// Tolerancia para dar por llegado: medio centésimo en la escala, tres centésimos de pixel o de grado en lo demás
const TOLERANCIA: Valores = { x: 0.03, y: 0.03, r: 0.03, s: 0.0006, rx: 0.03, ry: 0.03 }

const activos = new Set<Cuerpo>()
const cuerpos = new WeakMap<Element, Cuerpo>()
const valores = new Set<Valor>()
const tareas = new Set<(dt: number) => void>()

export class Cuerpo {
  p: Valores = { ...REPOSO }
  v: Valores = { x: 0, y: 0, r: 0, s: 0, rx: 0, ry: 0 }
  m: Valores = { ...REPOSO }
  // Rigidez y amortiguación propias (null: las del nivel)
  k: number | null = null
  c: number | null = null
  // Se llama una vez cuando llega a su meta
  alQuieto: (() => void) | null = null
  readonly el: HTMLElement | SVGElement
  readonly perspectiva: number
  readonly ancho: number
  private inclina = false

  constructor(el: HTMLElement | SVGElement) {
    this.el = el
    const r = el.getBoundingClientRect()
    this.ancho = r.width || 100
    this.perspectiva = Math.max(420, 4 * Math.max(r.width, r.height))
  }

  // Hacia dónde va (sin "reducir movimiento" llega con el resorte; con, al tiro)
  meta(o: Partial<Valores>) {
    Object.assign(this.m, o)
    if (reducido) for (const q of Object.keys(o) as Prop[]) this.p[q] = this.m[q]
    this.despertar()
    return this
  }

  // Desde dónde parte (para entrar desde afuera o para seguir desde donde se veía). Con "reducir movimiento" no cambia.
  pos(o: Partial<Valores>) {
    if (reducido) return this
    Object.assign(this.p, o)
    this.despertar()
    return this
  }

  // Un impulso (un salto que vuelve solo)
  vel(o: Partial<Valores>) {
    if (reducido) return this
    for (const q of Object.keys(o) as Prop[]) this.v[q] += o[q] ?? 0
    this.despertar()
    return this
  }

  // Lo pone ahí mismo, sin resorte: para seguir al dedo
  fijar(o: Partial<Valores>) {
    for (const q of Object.keys(o) as Prop[]) {
      this.p[q] = o[q] ?? 0
      this.m[q] = o[q] ?? 0
      this.v[q] = 0
    }
    this.despertar()
    return this
  }

  paso(dt: number) {
    const k = this.k ?? NIVEL.rigidez
    const c = this.c ?? NIVEL.amortiguacion
    for (const q of PROPS) [this.p[q], this.v[q]] = pasoResorte(this.p[q], this.v[q], this.m[q], k, c, dt)
  }

  quieto(): boolean {
    return PROPS.every((q) => llego(this.p[q], this.v[q], this.m[q], TOLERANCIA[q]))
  }

  asentar() {
    for (const q of PROPS) {
      this.p[q] = this.m[q]
      this.v[q] = 0
    }
  }

  aplicar() {
    const { x, y, r, s, rx, ry } = this.p
    const estilo = this.el.style
    estilo.translate = Math.abs(x) < 0.01 && Math.abs(y) < 0.01 ? '' : `${x.toFixed(2)}px ${y.toFixed(2)}px`
    estilo.rotate = Math.abs(r) < 0.01 ? '' : `${r.toFixed(2)}deg`
    estilo.scale = Math.abs(s - 1) < 0.0005 ? '' : s.toFixed(4)
    if (this.inclina || Math.abs(rx) >= 0.01 || Math.abs(ry) >= 0.01) {
      this.inclina = Math.abs(rx) >= 0.01 || Math.abs(ry) >= 0.01
      estilo.transform = this.inclina ? `perspective(${this.perspectiva}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` : ''
    }
  }

  private despertar() {
    activos.add(this)
    this.aplicar()
    arrancar()
  }
}

// El cuerpo de un elemento (se crea la primera vez)
export function cuerpo(el: HTMLElement | SVGElement): Cuerpo {
  let c = cuerpos.get(el)
  if (!c) {
    c = new Cuerpo(el)
    cuerpos.set(el, c)
  }
  return c
}

// El cuerpo de un elemento solo si ya tiene uno (para saber cuánto está corrido sin crearlo)
export function cuerpoExistente(el: Element): Cuerpo | undefined {
  return cuerpos.get(el)
}

// Escala según el ancho del elemento: lo ancho se mueve menos
export function escala(el: HTMLElement | SVGElement, s: number): number {
  return escalaSegunAncho(s, cuerpo(el).ancho)
}

// Un empujón: el elemento salta (y gira un poco, si se pide) y vuelve solo
export function empujon(el: HTMLElement | SVGElement | null | undefined, { s = 1, r = 0 }: { s?: number; r?: number } = {}) {
  if (!el || reducido) return
  const c = cuerpo(el)
  c.vel({ s: NIVEL.empujon * 0.5 * s * Math.min(1, 140 / c.ancho), r: NIVEL.empujon * r * (Math.random() < 0.5 ? -1 : 1) * 10 })
}

// "No": un temblor corto de lado a lado, para lo que no se puede (siempre va con un aviso que dice por qué)
export function sacudir(el: HTMLElement | SVGElement | null | undefined) {
  if (!el || reducido) return
  const c = cuerpo(el)
  c.k = 900
  c.c = 13
  c.meta({ x: 0 }).vel({ x: 520 })
  c.alQuieto = () => {
    c.k = null
    c.c = null
  }
}

// Un valor suelto con resorte, para lo que no es un cuerpo (el ancho de una pastilla, la raya de la barra)
export class Valor {
  x: number
  v = 0
  m: number
  // Se llama una vez cuando llega a su meta
  alQuieto: (() => void) | null = null
  readonly alCambiar: (x: number, v: number) => void
  constructor(inicial: number, alCambiar: (x: number, v: number) => void) {
    this.x = inicial
    this.m = inicial
    this.alCambiar = alCambiar
  }
  ir(meta: number) {
    this.m = meta
    if (reducido) return this.fijar(meta)
    valores.add(this)
    arrancar()
  }
  fijar(x: number) {
    this.x = x
    this.m = x
    this.v = 0
    valores.delete(this)
    this.alCambiar(x, 0)
  }
}

// Algo que hay que hacer en cada cuadro (seguir girando, desplazar la lista al arrastrar). Devuelve cómo quitarlo.
export function cadaCuadro(tarea: (dt: number) => void): () => void {
  tareas.add(tarea)
  arrancar()
  return () => {
    tareas.delete(tarea)
  }
}

let corriendo = false
let antes = 0
let resto = 0

function arrancar() {
  if (corriendo || typeof requestAnimationFrame === 'undefined') return
  corriendo = true
  antes = performance.now()
  resto = 0
  requestAnimationFrame(cuadro)
}

function cuadro(ahora: number) {
  const dt = Math.min(0.05, Math.max(0, (ahora - antes) / 1000))
  antes = ahora
  resto += dt
  while (resto >= PASO) {
    for (const c of activos) c.paso(PASO)
    for (const v of valores) [v.x, v.v] = pasoResorte(v.x, v.v, v.m, NIVEL.rigidez, NIVEL.amortiguacion, PASO)
    resto -= PASO
  }
  for (const c of activos) {
    if (!c.el.isConnected) {
      activos.delete(c)
      continue
    }
    if (c.quieto()) {
      c.asentar()
      c.aplicar()
      activos.delete(c)
      const fin = c.alQuieto
      c.alQuieto = null
      fin?.()
    } else c.aplicar()
  }
  for (const v of valores) {
    const llegado = llego(v.x, v.v, v.m, 0.05)
    if (llegado) {
      v.x = v.m
      v.v = 0
      valores.delete(v)
    }
    v.alCambiar(v.x, v.v)
    if (llegado) {
      const fin = v.alQuieto
      v.alQuieto = null
      fin?.()
    }
  }
  for (const t of tareas) t(dt)
  if (activos.size || valores.size || tareas.size) requestAnimationFrame(cuadro)
  else corriendo = false
}

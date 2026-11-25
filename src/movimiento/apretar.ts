import { NIVEL } from './fisica.ts'
import { alEmpezarGesto, hayGesto } from './gesto.ts'
import { cadaCuadro, cuerpo, darJugo, escala, sinMovimiento } from './resortes.ts'
import { sonar, vibrar } from './sonido.ts'

// Todo lo que se aprieta responde (reemplaza el movimiento del "hundido" de base.css, que deja solo el tono):
// - al apretar se hunde dos pixeles y se achica alrededor del dedo; al soltar tiembla un instante, como las cartas de
//   Balatro. Lo ancho (una fila, una tarjeta) se achica y tiembla menos que un botón;
// - con el dedo espera un instante antes de hundirse: si el dedo empieza a desplazar la pantalla, no se hunde nada. Un
//   toque más corto que esa espera se hunde y tiembla al soltar;
// - con el mouse encima se levanta un pixel (solo en dispositivos con mouse);
// - las tarjetas ([data-carta]) además se inclinan hacia el dedo o el mouse, con un brillo (<Brillo />).
// Se instala una vez para toda la app (main.tsx) y escucha en el documento: no hace falta tocar cada botón.
// Para excluir algo: data-sin-hundido. Un interruptor cuyo único hijo es su pista ([data-activo]) mueve la pista.

const APRETABLE = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
  'label:has(> input[type="radio"], > input[type="checkbox"])',
  '[data-carta]',
].join(',')

const conMouse = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null

// El elemento que responde a lo que se tocó (o null)
export function apretableDe(objetivo: EventTarget | null): HTMLElement | null {
  if (!(objetivo instanceof Element)) return null
  const el = objetivo.closest<HTMLElement>(APRETABLE)
  if (!el || el.matches(':disabled, [aria-disabled="true"], [data-sin-hundido]') || el.closest('[data-sin-hundido]')) return null
  if (el.matches('[role="switch"]') && el.children.length === 1 && el.firstElementChild?.matches('[data-activo]')) return el.firstElementChild as HTMLElement
  return el
}

const esCarta = (el: HTMLElement) => el.hasAttribute('data-carta')

let apretado: { el: HTMLElement; id: number } | null = null
// Con el dedo: lo que se hunde si el dedo sigue quieto cuando pase NIVEL.esperaDedo. Se cuenta en cuadros y no con
// setTimeout, porque mientras un dedo se apoya Chrome atrasa los temporizadores de la página (para desplazar rápido)
let porApretar: { el: HTMLElement; id: number; x: number; y: number; desde: number; quitar: () => void } | null = null
let encima: HTMLElement | null = null
const medidas = new WeakMap<HTMLElement, DOMRect>()

// Inclina una tarjeta hacia el punto (y mueve su brillo)
function inclinar(el: HTMLElement, x: number, y: number) {
  if (!esCarta(el) || sinMovimiento()) return
  let r = medidas.get(el)
  if (!r) {
    r = el.getBoundingClientRect()
    medidas.set(el, r)
  }
  const px = Math.min(1, Math.max(0, (x - r.left) / r.width))
  const py = Math.min(1, Math.max(0, (y - r.top) / r.height))
  cuerpo(el).meta({ ry: (px - 0.5) * 2 * NIVEL.inclinar, rx: -(py - 0.5) * 2 * NIVEL.inclinar })
  el.style.setProperty('--brillo-x', `${(px * 100).toFixed(1)}%`)
  el.style.setProperty('--brillo-y', `${(py * 100).toFixed(1)}%`)
  el.style.setProperty('--brillo', String(NIVEL.brillo))
}

function enderezar(el: HTMLElement) {
  medidas.delete(el)
  if (!esCarta(el)) return
  cuerpo(el).meta({ rx: 0, ry: 0 })
  el.style.setProperty('--brillo', '0')
}

function levantar(el: HTMLElement) {
  cuerpo(el).meta({ s: escala(el, esCarta(el) ? 1.018 : NIVEL.encima), y: esCarta(el) ? 0 : -1 })
}

function bajar(el: HTMLElement) {
  cuerpo(el).meta({ s: 1, y: 0 })
  enderezar(el)
}

// Al dejar de apretar vuelve con el resorte de siempre (salvo que otro, como el "no" de sacudir, ya lo haya cambiado)
function resorteDeSiempre(el: HTMLElement) {
  const c = cuerpo(el)
  if (c.k !== NIVEL.rigidezApretar) return
  c.k = null
  c.c = null
}

function cancelarEspera() {
  if (!porApretar) return
  porApretar.quitar()
  porApretar = null
}

// Al empezar un gesto (arrastrar, deslizar), lo apretado deja de verse apretado
export function cancelarApretar() {
  cancelarEspera()
  if (!apretado) return
  const { el } = apretado
  apretado = null
  resorteDeSiempre(el)
  bajar(el)
}

// Se hunde con un resorte firme, alrededor del punto apretado: así ese punto sigue sobre el elemento al soltar y el
// toque cuenta aunque sea cerca del borde (si se achicara hacia su centro, el borde se alejaría del dedo y el clic se
// perdería)
function apretar(el: HTMLElement, id: number, x: number, y: number) {
  apretado = { el, id }
  const carta = esCarta(el)
  const r = el.getBoundingClientRect()
  el.style.transformOrigin = `${(x - r.left).toFixed(1)}px ${(y - r.top).toFixed(1)}px`
  const c = cuerpo(el)
  c.k = NIVEL.rigidezApretar
  c.c = NIVEL.amortiguacionApretar
  c.meta({ s: escala(el, carta ? 1 - (1 - NIVEL.apretar) * 0.5 : NIVEL.apretar, NIVEL.anchoApretar), y: carta ? 0 : 2 })
  if (carta) {
    medidas.delete(el)
    inclinar(el, x, y)
  }
  vibrar(NIVEL.vibrarApretar)
  sonar('toque')
}

function alBajar(e: PointerEvent) {
  // Con "reducir movimiento" solo cambia el tono (base.css)
  if (e.button > 0 || sinMovimiento()) return
  const el = apretableDe(e.target)
  if (!el) return
  cancelarEspera()
  if (e.pointerType === 'mouse') return apretar(el, e.pointerId, e.clientX, e.clientY)
  const espera = { el, id: e.pointerId, x: e.clientX, y: e.clientY, desde: performance.now(), quitar: () => {} }
  espera.quitar = cadaCuadro(() => {
    if (porApretar !== espera) return espera.quitar()
    if (performance.now() - espera.desde < NIVEL.esperaDedo) return
    espera.quitar()
    porApretar = null
    apretar(el, espera.id, espera.x, espera.y)
  })
  porApretar = espera
}

function alSoltar(e: PointerEvent) {
  // Un toque más corto que la espera se hunde ahora y tiembla al soltar (si no fue para desplazar la pantalla)
  if (porApretar && porApretar.id === e.pointerId) {
    const { el, id, x, y } = porApretar
    cancelarEspera()
    if (e.type === 'pointerup') apretar(el, id, x, y)
  }
  if (!apretado || apretado.id !== e.pointerId) return
  const { el } = apretado
  apretado = null
  resorteDeSiempre(el)
  // Vuelve desde donde está, sin seguir hundiéndose por la velocidad que traía: el salto lo pone el temblor
  const c = cuerpo(el)
  c.v.s = 0
  c.v.y = 0
  const sigueEncima = e.pointerType === 'mouse' && encima === el && conMouse?.matches
  if (sigueEncima) levantar(el)
  else bajar(el)
  // Al soltar tiembla; si el dedo se fue a desplazar la pantalla (pointercancel), vuelve sin temblar
  if (e.type === 'pointerup') darJugo(el)
  // Al quedar quieto vuelve a crecer y achicarse desde su centro (sin quitar lo que ya esperaba ese momento)
  const antes = c.alQuieto
  c.alQuieto = () => {
    if (apretado?.el !== el) el.style.transformOrigin = ''
    antes?.()
  }
}

// Con el mouse: lo que está debajo se levanta, y la tarjeta que lo contiene (o que es) se inclina hacia él
let cartaEncima: HTMLElement | null = null

function alMover(e: PointerEvent) {
  // El dedo se movió antes de hundirse: va a desplazar la pantalla o a arrastrar, no a tocar
  if (porApretar && porApretar.id === e.pointerId && Math.hypot(e.clientX - porApretar.x, e.clientY - porApretar.y) > 8) cancelarEspera()
  if (apretado && apretado.id === e.pointerId && e.pointerType !== 'mouse') return inclinar(apretado.el, e.clientX, e.clientY)
  if (e.pointerType !== 'mouse' || !conMouse?.matches || hayGesto() || sinMovimiento()) return
  const el = apretableDe(e.target)
  if (el !== encima) {
    if (encima && encima !== apretado?.el) bajar(encima)
    encima = el
    if (el && el !== apretado?.el) levantar(el)
  }
  const carta = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-carta]') : null
  if (carta !== cartaEncima) {
    if (cartaEncima && cartaEncima !== apretado?.el && cartaEncima !== encima) enderezar(cartaEncima)
    cartaEncima = carta
  }
  if (carta) inclinar(carta, e.clientX, e.clientY)
}

function alSalir(e: PointerEvent) {
  // El mouse salió de la ventana
  if (e.pointerType !== 'mouse' || e.relatedTarget) return
  if (encima) bajar(encima)
  if (cartaEncima) enderezar(cartaEncima)
  encima = null
  cartaEncima = null
}

let instalado = false

export function instalarMovimiento() {
  if (instalado || typeof document === 'undefined') return
  instalado = true
  document.addEventListener('pointerdown', alBajar, true)
  document.addEventListener('pointerup', alSoltar, true)
  document.addEventListener('pointercancel', alSoltar, true)
  document.addEventListener('pointermove', alMover, { passive: true })
  document.addEventListener('pointerout', alSalir, true)
  // Al desplazar, las medidas de las tarjetas cambian
  document.addEventListener(
    'scroll',
    () => {
      if (encima) medidas.delete(encima)
      if (cartaEncima) medidas.delete(cartaEncima)
    },
    { capture: true, passive: true },
  )
  alEmpezarGesto(cancelarApretar)
}

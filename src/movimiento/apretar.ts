import { NIVEL } from './fisica.ts'
import { alEmpezarGesto, hayGesto } from './gesto.ts'
import { cuerpo, escala, sinMovimiento } from './resortes.ts'
import { sonar } from './sonido.ts'

// Todo lo que se aprieta responde (reemplaza el movimiento del "hundido" de base.css, que deja solo el tono):
// - al apretar se hunde un pixel y se achica; al soltar rebota;
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

// Al empezar un gesto (arrastrar, deslizar), lo apretado deja de verse apretado
export function cancelarApretar() {
  if (!apretado) return
  const { el } = apretado
  apretado = null
  bajar(el)
}

function alBajar(e: PointerEvent) {
  // Con "reducir movimiento" solo cambia el tono (base.css)
  if (e.button > 0 || sinMovimiento()) return
  const el = apretableDe(e.target)
  if (!el) return
  apretado = { el, id: e.pointerId }
  const carta = esCarta(el)
  // Se achica alrededor del dedo: así el punto apretado sigue sobre el elemento al soltar y el toque cuenta, aunque
  // sea cerca del borde (si se achicara hacia su centro, el borde se alejaría del dedo y el clic se perdería)
  const r = el.getBoundingClientRect()
  el.style.transformOrigin = `${(e.clientX - r.left).toFixed(1)}px ${(e.clientY - r.top).toFixed(1)}px`
  cuerpo(el).meta({ s: escala(el, carta ? 1 - (1 - NIVEL.apretar) * 0.5 : NIVEL.apretar), y: carta ? 0 : 1 })
  if (carta) {
    medidas.delete(el)
    inclinar(el, e.clientX, e.clientY)
  }
  sonar('toque')
}

function alSoltar(e: PointerEvent) {
  if (!apretado || apretado.id !== e.pointerId) return
  const { el } = apretado
  apretado = null
  const sigueEncima = e.pointerType === 'mouse' && encima === el && conMouse?.matches
  if (sigueEncima) levantar(el)
  else bajar(el)
  // El rebote: un salto que vuelve solo. Al llegar, vuelve a crecer y achicarse desde su centro.
  const c = cuerpo(el)
  c.vel({ s: 0.55 * NIVEL.empujon * Math.min(1, 140 / c.ancho) })
  c.alQuieto = () => {
    if (apretado?.el !== el) el.style.transformOrigin = ''
  }
}

// Con el mouse: lo que está debajo se levanta, y la tarjeta que lo contiene (o que es) se inclina hacia él
let cartaEncima: HTMLElement | null = null

function alMover(e: PointerEvent) {
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

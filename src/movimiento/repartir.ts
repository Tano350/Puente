import { NIVEL } from './fisica.ts'
import { cuerpo, sinMovimiento } from './resortes.ts'

// Al entrar a una pantalla, sus tarjetas y filas que se ven llegan una tras otra desde un poco más abajo, giradas y
// chicas, como cartas que se reparten (NIVEL.reparto). Se reparten las tarjetas ([data-carta]), las filas de las listas
// que se reacomodan ([data-flip]) y lo marcado con data-reparte; lo que está dentro de otra que se reparte va con ella.
const REPARTIBLE = '[data-carta], [data-flip], [data-reparte]'

export function repartir(pantalla: HTMLElement) {
  if (sinMovimiento()) return
  const alto = window.innerHeight
  const { y, giro, escala, paso, max } = NIVEL.reparto
  let i = 0
  for (const el of pantalla.querySelectorAll<HTMLElement>(REPARTIBLE)) {
    if (i >= max) break
    const padre = el.parentElement?.closest(REPARTIBLE)
    if (padre && pantalla.contains(padre)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.bottom <= 0 || r.top >= alto) continue
    const c = cuerpo(el)
    const cuando = 30 + i * paso
    c.fijar({ y, r: (Math.random() - 0.5) * giro, s: escala })
    window.setTimeout(() => c.meta({ y: 0, r: 0, s: 1 }), cuando)
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: cuando, fill: 'backwards' })
    i++
  }
}

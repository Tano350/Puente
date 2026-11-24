import { useLayoutEffect, useRef, type RefObject } from 'react'
import { cuerpo, cuerpoExistente, sinMovimiento } from './resortes.ts'

// Listas que se reacomodan: después de cada render, lo que tiene data-flip="clave" y cambió de lugar se desliza
// desde donde estaba (FLIP), y lo nuevo aparece con un salto chico. La clave identifica la misma cosa aunque cambie de
// lista: un evento que pasa de "También hoy" a "Tu día" vuela de una a la otra si las dos están dentro del contenedor.
// Las posiciones se miden contra el contenedor, así que desplazar la pantalla no cuenta como moverse.
export function useFlip(contenedor: RefObject<HTMLElement | null>, { nuevos = true }: { nuevos?: boolean } = {}) {
  const antes = useRef<Map<string, { x: number; y: number }> | null>(null)
  useLayoutEffect(() => {
    const raiz = contenedor.current
    if (!raiz) return
    const base = raiz.getBoundingClientRect()
    const ahora = new Map<string, { x: number; y: number }>()
    const previas = antes.current
    for (const el of raiz.querySelectorAll<HTMLElement>('[data-flip]')) {
      const clave = el.dataset.flip
      if (!clave) continue
      const r = el.getBoundingClientRect()
      const corrido = cuerpoExistente(el)?.p ?? { x: 0, y: 0 }
      // Dónde está sin lo que ya lo tenga corrido una animación en curso
      const lugar = { x: r.left - base.left - corrido.x, y: r.top - base.top - corrido.y }
      ahora.set(clave, lugar)
      if (!previas || sinMovimiento()) continue
      const previa = previas.get(clave)
      if (previa) {
        const dx = previa.x - lugar.x
        const dy = previa.y - lugar.y
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) cuerpo(el).pos({ x: corrido.x + dx, y: corrido.y + dy }).meta({ x: 0, y: 0 })
      } else if (nuevos) {
        cuerpo(el).pos({ s: 0.94, y: corrido.y + 6 }).meta({ s: 1, y: 0 })
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
      }
    }
    antes.current = ahora
  })
}

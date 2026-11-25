import { useLayoutEffect, useRef, type RefObject } from 'react'
import { NIVEL } from './fisica.ts'
import { Valor } from './resortes.ts'

// Dónde quedó cada marca con clave: un selector que cambia de pantalla (Estadías / Intereses) se arma de nuevo en la
// otra, y así su marca parte desde donde estaba y se desliza
const recuerdos = new Map<string, { pos: number; largo: number }>()

// La marca de lo elegido (la pastilla de "Todas / Mías", la raya de la barra de secciones) se desliza hasta la opción
// elegida. El contenedor tiene position: relative y un hijo con data-pastilla; la opción elegida es la que tiene
// aria-pressed, aria-selected o aria-current="page". Si no hay ninguna elegida, la marca no se ve.
export function usePastilla(contenedor: RefObject<HTMLElement | null>, eje: 'x' | 'y' = 'x', clave?: string) {
  const estado = useRef<{ marca: HTMLElement | null; pos: Valor; largo: Valor; visto: boolean } | null>(null)
  const medir = useRef<(animar: boolean) => void>(() => {})

  // Después de cada render: si cambió la opción elegida, la marca se desliza hasta ella
  useLayoutEffect(() => {
    const raiz = contenedor.current
    const marca = raiz?.querySelector<HTMLElement>(':scope > [data-pastilla]')
    if (!raiz || !marca) return
    if (!estado.current) {
      const aplicar = () => {
        const e = estado.current
        if (!e?.marca) return
        // Mientras se desliza se estira: la punta llega primero y la cola la alcanza
        const estirar = Math.min(NIVEL.estirar, Math.abs(e.pos.v) * 0.025)
        const pos = e.pos.x - (e.pos.v > 0 ? estirar : 0)
        const largo = Math.max(0, e.largo.x + estirar)
        if (eje === 'x') {
          e.marca.style.translate = `${pos.toFixed(2)}px 0`
          e.marca.style.width = `${largo.toFixed(2)}px`
        } else {
          e.marca.style.translate = `0 ${pos.toFixed(2)}px`
          e.marca.style.height = `${largo.toFixed(2)}px`
        }
      }
      estado.current = { marca, pos: new Valor(0, aplicar), largo: new Valor(0, aplicar), visto: false }
    }
    const e = estado.current
    e.marca = marca
    medir.current = (animar) => {
      const elegida = raiz.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"], [aria-current="page"]')
      if (!elegida) {
        marca.style.opacity = '0'
        e.visto = false
        return
      }
      const r = raiz.getBoundingClientRect()
      const o = elegida.getBoundingClientRect()
      // Medido desde el borde interior del contenedor, que es desde donde se ubica la marca
      const pos = eje === 'x' ? o.left - r.left - raiz.clientLeft : o.top - r.top - raiz.clientTop
      const largo = eje === 'x' ? o.width : o.height
      marca.style.opacity = ''
      const antes = clave ? recuerdos.get(clave) : undefined
      if (clave) recuerdos.set(clave, { pos, largo })
      // Recién armado en otra pantalla: parte desde donde quedó allá
      if (animar && !e.visto && antes) {
        e.pos.fijar(antes.pos)
        e.largo.fijar(antes.largo)
        e.visto = true
      }
      if (animar && e.visto) {
        e.pos.ir(pos)
        e.largo.ir(largo)
      } else {
        e.pos.fijar(pos)
        e.largo.fijar(largo)
      }
      e.visto = true
    }
    medir.current(true)
  })

  // Si cambia el tamaño (letras que terminan de cargar, girar el teléfono), se acomoda sin animar
  useLayoutEffect(() => {
    const raiz = contenedor.current
    if (!raiz) return
    let ancho = raiz.offsetWidth
    let alto = raiz.offsetHeight
    const observador = new ResizeObserver(() => {
      if (raiz.offsetWidth === ancho && raiz.offsetHeight === alto) return
      ancho = raiz.offsetWidth
      alto = raiz.offsetHeight
      medir.current(false)
    })
    observador.observe(raiz)
    return () => observador.disconnect()
  }, [contenedor])
}

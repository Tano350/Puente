import { useLayoutEffect, useRef } from 'react'
import { Valor } from '../../movimiento/index.ts'

// El hueco donde va a caer lo que se arrastra (arrastre.ts): se abre con un resorte hasta el alto de lo levantado y se
// cierra cuando el dedo se va. La clase dibuja la línea punteada (con ::before, para que cerrado no ocupe nada).
export function Hueco({ abierto, alto, className }: { abierto: boolean; alto: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const valor = useRef<Valor | null>(null)
  const altoFinal = useRef(alto)
  useLayoutEffect(() => {
    altoFinal.current = alto
    const el = ref.current
    if (!el) return
    valor.current ??= new Valor(0, (h) => {
      const visible = Math.max(0, h)
      el.style.height = `${visible.toFixed(1)}px`
      el.style.opacity = String(altoFinal.current > 0 ? Math.min(1, visible / altoFinal.current) : 0)
    })
    valor.current.ir(abierto ? alto : 0)
  }, [abierto, alto])
  return <div ref={ref} className={className} data-hueco="" aria-hidden="true" />
}

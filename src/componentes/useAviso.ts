import { useEffect, useRef, useState } from 'react'

// Se ve un aviso a la vez: mostrar uno cierra el que haya en otra parte de la pantalla
const abiertos = new Set<() => void>()

// El aviso de abajo dura unos segundos; si se puede deshacer, un poco más
export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: () => void } | null>(null)
  const reloj = useRef<number | undefined>(undefined)
  const cerrarEste = useRef(() => setAviso(null))
  useEffect(() => {
    const cerrar = cerrarEste.current
    return () => {
      window.clearTimeout(reloj.current)
      abiertos.delete(cerrar)
    }
  }, [])
  const mostrar = (texto: string, deshacer?: () => void) => {
    for (const cerrarOtro of abiertos) if (cerrarOtro !== cerrarEste.current) cerrarOtro()
    abiertos.add(cerrarEste.current)
    setAviso({ texto, deshacer })
    window.clearTimeout(reloj.current)
    reloj.current = window.setTimeout(() => setAviso(null), deshacer ? 6000 : 4000)
  }
  const cerrar = () => {
    window.clearTimeout(reloj.current)
    setAviso(null)
  }
  return { texto: aviso?.texto ?? null, deshacer: aviso?.deshacer, mostrar, cerrar }
}

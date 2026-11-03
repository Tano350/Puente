import { useEffect, useRef, useState } from 'react'

// El aviso de abajo dura unos segundos; si se puede deshacer, un poco más
export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: () => void } | null>(null)
  const reloj = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(reloj.current), [])
  const mostrar = (texto: string, deshacer?: () => void) => {
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

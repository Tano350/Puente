import { useEffect, useState } from 'react'

const CONSULTA = '(min-width: 1024px)'

// Desde 1024 px se usa el diseño de computador (barra lateral y paneles)
export function useEsComputador(): boolean {
  const [es, setEs] = useState(() => window.matchMedia(CONSULTA).matches)
  useEffect(() => {
    const medida = window.matchMedia(CONSULTA)
    const cambiar = () => setEs(medida.matches)
    medida.addEventListener('change', cambiar)
    return () => medida.removeEventListener('change', cambiar)
  }, [])
  return es
}

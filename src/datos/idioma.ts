import { useSyncExternalStore } from 'react'

// Idioma de la app: español (por defecto) o inglés. Este dispositivo lo recuerda para la pantalla de entrar;
// al entrar manda el de tu perfil (lo pone la sesión).
export type Idioma = 'es' | 'en'

const GUARDADO = 'puente.idioma'
const oyentes = new Set<() => void>()

function leerGuardado(): Idioma {
  try {
    return localStorage.getItem(GUARDADO) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function marcarDocumento(idioma: Idioma) {
  if (typeof document !== 'undefined') document.documentElement.lang = idioma
}

let actual: Idioma = leerGuardado()
marcarDocumento(actual)

export function idiomaActual(): Idioma {
  return actual
}

export function cambiarIdioma(idioma: Idioma) {
  if (idioma === actual) return
  actual = idioma
  marcarDocumento(idioma)
  try {
    localStorage.setItem(GUARDADO, idioma)
  } catch {
    // Sin almacenamiento solo no se recuerda
  }
  for (const oyente of oyentes) oyente()
}

export function useIdioma(): Idioma {
  return useSyncExternalStore((oyente) => {
    oyentes.add(oyente)
    return () => {
      oyentes.delete(oyente)
    }
  }, idiomaActual)
}

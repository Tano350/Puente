import { useSyncExternalStore } from 'react'

// Modo de la pantalla: oscuro (por defecto) o claro. Lo elige cada dispositivo en Tu perfil, sin importar cómo esté
// el teléfono. index.html hace lo mismo antes de dibujar la página, para que al abrir no se vea un destello del
// otro modo: si cambia la clave o los colores, cambiarlos también allá.
export type Tema = 'oscuro' | 'claro'

const GUARDADO = 'puente.tema'
// La barra del sistema va del color del fondo de cada modo (base.css)
const BARRA: Record<Tema, string> = { oscuro: '#1E242C', claro: '#EEF1F4' }
const oyentes = new Set<() => void>()

function leerGuardado(): Tema {
  try {
    return localStorage.getItem(GUARDADO) === 'claro' ? 'claro' : 'oscuro'
  } catch {
    return 'oscuro'
  }
}

function marcarDocumento(tema: Tema) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.tema = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BARRA[tema])
}

let actual: Tema = leerGuardado()
marcarDocumento(actual)

export function temaActual(): Tema {
  return actual
}

export function cambiarTema(tema: Tema) {
  if (tema === actual) return
  actual = tema
  marcarDocumento(tema)
  try {
    localStorage.setItem(GUARDADO, tema)
  } catch {
    // Sin almacenamiento solo no se recuerda
  }
  for (const oyente of oyentes) oyente()
}

export function useTema(): Tema {
  return useSyncExternalStore((oyente) => {
    oyentes.add(oyente)
    return () => {
      oyentes.delete(oyente)
    }
  }, temaActual)
}

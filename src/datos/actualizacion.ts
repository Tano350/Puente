import { consultas } from './consultas.ts'

// La app instalada se pone al día sola. Antes la versión nueva se instalaba y quedaba esperando hasta que la app se
// cerrara del todo (el celular la deja abierta en segundo plano), y nadie preguntaba si había otra.
// Ahora pregunta al abrirse y cada vez que vuelve a la pantalla. Cuando hay una versión nueva instalada, en un momento
// tranquilo (sin un campo con el cursor, sin una hoja o una pantalla de crear abierta y sin algo guardándose) le pide
// que tome el control y recarga apenas lo toma: así la página vieja no sigue andando con archivos que ya no están. Si
// hay algo a medias, espera a que termine. Solo en la app publicada: en desarrollo no hay service worker.
export function instalarActualizacion() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  // Sin versión a cargo es la primera vez que se abre: la que toma el control no reemplaza nada y no hace falta recargar
  let habia = Boolean(sw.controller)
  let registro: ServiceWorkerRegistration | undefined
  let recargar = false
  let reloj = 0
  // Mira si hay algo que hacer y si es buen momento; si no lo es, vuelve a mirar cada 3 segundos
  const revisar = () => {
    if (algoAMedias()) {
      if (!reloj && (recargar || registro?.waiting)) reloj = window.setInterval(revisar, 3000)
      return
    }
    if (recargar) return window.location.reload()
    // La versión nueva espera a que se le pida tomar el control (vite.config.ts): se le pide ahora
    registro?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }
  sw.addEventListener('controllerchange', () => {
    if (!habia) {
      habia = true
      return
    }
    recargar = true
    revisar()
  })
  const registrar = () => {
    sw.register('/sw.js', { scope: '/' }).then(
      (r) => {
        registro = r
        // Una versión que termina de instalarse con la app abierta
        r.addEventListener('updatefound', () => {
          const nueva = r.installing
          nueva?.addEventListener('statechange', () => {
            if (nueva.state === 'installed') revisar()
          })
        })
        // Una que ya esperaba desde antes
        revisar()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') r.update().catch(() => {})
          // Al irse a segundo plano, si había una versión esperando, se pone sin que se note
          revisar()
        })
      },
      () => {
        // Sin service worker la app igual funciona, pero no abre sin señal ni recibe avisos
      },
    )
  }
  // Después de cargar todo, para no competir con la primera pantalla
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar, { once: true })
}

// Algo a medias: un campo con el cursor, una hoja o una pantalla de crear abierta, o algo que se está guardando
function algoAMedias(): boolean {
  const activo = document.activeElement
  if (activo instanceof HTMLElement && (activo.isContentEditable || activo.matches('input, textarea, select'))) return true
  if (document.querySelector('[role="dialog"], [aria-modal="true"], [data-encima]')) return true
  return consultas.isMutating() > 0
}

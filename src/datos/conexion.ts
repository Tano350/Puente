import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

// ¿Hay conexión? Sigue lo que dice el navegador; TanStack Query usa lo mismo para pausar y retomar lo que se escribe.
// En desarrollo, ?sinsenal en la dirección hace como si no hubiera señal, para revisar esos estados.
const simulado = import.meta.env.DEV && new URLSearchParams(window.location.search).has('sinsenal')

if (simulado) {
  // Sin señal de mentira: el navegador no la devuelve; solo window.puenteSenal(true)
  onlineManager.setEventListener(() => undefined)
  onlineManager.setOnline(false)
} else {
  // TanStack parte creyendo que hay señal; si la app abre sin señal, lo escrito tiene que quedar en espera desde el principio
  onlineManager.setEventListener((ponerConectado) => {
    const revisar = () => ponerConectado(navigator.onLine)
    revisar()
    window.addEventListener('online', revisar)
    window.addEventListener('offline', revisar)
    return () => {
      window.removeEventListener('online', revisar)
      window.removeEventListener('offline', revisar)
    }
  })
}

// Solo en desarrollo: window.puenteSenal(true) devuelve la señal (y sube lo que esperaba); puenteSenal(false) la quita
declare global {
  interface Window {
    puenteSenal?: (hay?: boolean) => void
  }
}
if (import.meta.env.DEV) window.puenteSenal = (hay = true) => onlineManager.setOnline(hay)

export function estaConectado(): boolean {
  return onlineManager.isOnline()
}

export function useConectado(): boolean {
  return useSyncExternalStore((oyente) => onlineManager.subscribe(oyente), estaConectado)
}

import { supabase } from './supabase.ts'

// Lo que depende de este dispositivo: si la app está instalada y si recibe avisos.

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let pedidoDeInstalar: EventoInstalar | null = null
window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault()
  pedidoDeInstalar = evento as EventoInstalar
})

const INSTALADA = 'puente.instalada'

export const esIPhone = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// En iPhone solo Safari puede instalar la app. Chrome, Firefox, Edge y los navegadores de adentro de otras apps
// (WhatsApp, Instagram, Facebook) llevan su propia marca en el agente o no dicen "Safari".
export const esSafari = /safari\//i.test(navigator.userAgent) && !/crios|fxios|edgios|opios|gsa\/|duckduckgo|fban|fbav|instagram|line\/|micromessenger/i.test(navigator.userAgent)

export function estaInstalada(): boolean {
  const independiente = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (independiente) return true
  try {
    return localStorage.getItem(INSTALADA) === '1'
  } catch {
    return false
  }
}

export function marcarInstalada() {
  try {
    localStorage.setItem(INSTALADA, '1')
  } catch {
    // Sin almacenamiento no se recuerda; no pasa nada
  }
}

// El navegador puede mostrar su propio aviso para instalar (Chrome y Edge, no Safari)
export function sePuedePedirInstalar(): boolean {
  return pedidoDeInstalar !== null
}

export async function pedirInstalar(): Promise<boolean> {
  if (!pedidoDeInstalar) return false
  await pedidoDeInstalar.prompt()
  const { outcome } = await pedidoDeInstalar.userChoice
  pedidoDeInstalar = null
  if (outcome === 'accepted') marcarInstalada()
  return outcome === 'accepted'
}

export const avisosPosibles = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function avisosActivos(): Promise<boolean> {
  if (!avisosPosibles || Notification.permission !== 'granted') return false
  const registro = await navigator.serviceWorker.getRegistration()
  return Boolean(await registro?.pushManager.getSubscription())
}

function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const binario = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export type ResultadoAvisos = 'activados' | 'bloqueados' | 'sinSoporte'

// Pide permiso, suscribe este dispositivo y lo guarda para que el servidor pueda avisar
export async function activarAvisos(persona: string): Promise<ResultadoAvisos> {
  if (!avisosPosibles) return 'sinSoporte'
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'bloqueados'
  const registro = await navigator.serviceWorker.ready
  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY) }))
  return (await guardarSuscripcion(persona, suscripcion)) ? 'activados' : 'sinSoporte'
}

async function guardarSuscripcion(persona: string, suscripcion: PushSubscription): Promise<boolean> {
  const { endpoint, keys } = suscripcion.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) return false
  const { error } = await supabase.from('suscripciones').upsert({ endpoint, persona, p256dh: keys.p256dh, auth: keys.auth })
  if (error) throw error
  return true
}

// Al abrir la app: si este dispositivo recibe avisos, vuelve a guardar la suscripción.
// Así queda al día si el navegador la renovó (el service worker no tiene sesión para guardarla).
export async function sincronizarSuscripcion(persona: string): Promise<void> {
  if (!avisosPosibles || Notification.permission !== 'granted') return
  const registro = await navigator.serviceWorker.getRegistration()
  let suscripcion = await registro?.pushManager.getSubscription()
  if (registro && !suscripcion && import.meta.env.VITE_VAPID_PUBLIC_KEY) {
    // La suscripción venció y el permiso sigue dado: se renueva sin molestar
    suscripcion = await registro.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY) })
      .catch(() => null)
  }
  if (suscripcion) await guardarSuscripcion(persona, suscripcion)
}

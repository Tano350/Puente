import { useSyncExternalStore } from 'react'

// Sonido y vibración al tocar: apagados por defecto; se encienden en Tu perfil y se guardan en el dispositivo, como
// el modo oscuro. Los sonidos se arman en el momento (Web Audio), sin archivos. En iPhone respetan el modo silencio;
// la vibración solo existe en Android.

const GUARDADO = 'puente.sonido'
const oyentes = new Set<() => void>()

function leerGuardado(): boolean {
  try {
    return localStorage.getItem(GUARDADO) === 'si'
  } catch {
    return false
  }
}

let encendido = leerGuardado()

export function sonidoEncendido(): boolean {
  return encendido
}

export function cambiarSonido(si: boolean) {
  if (si === encendido) return
  encendido = si
  try {
    if (si) localStorage.setItem(GUARDADO, 'si')
    else localStorage.removeItem(GUARDADO)
  } catch {
    // Sin almacenamiento solo no se recuerda
  }
  for (const oyente of oyentes) oyente()
  if (si) {
    sonar('pop', 0.3)
    vibrar(10)
  }
}

export function useSonido(): boolean {
  return useSyncExternalStore((oyente) => {
    oyentes.add(oyente)
    return () => {
      oyentes.delete(oyente)
    }
  }, sonidoEncendido)
}

let contexto: AudioContext | null = null
let ruido: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (!contexto) {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return null
    // En iPhone (Safari 16.4 o más), "ambient" respeta el botón de silencio
    const sesion = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (sesion) sesion.type = 'ambient'
    contexto = new Contexto()
    const b = contexto.createBuffer(1, Math.round(contexto.sampleRate * 0.4), contexto.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    ruido = b
  }
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

function tono(f0: number, f1: number, dur: number, vol: number, tipo: OscillatorType = 'sine', despues = 0) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + despues
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = tipo
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.03)
}

function soplo(f0: number, f1: number, dur: number, vol: number, q = 1.2) {
  const a = audio()
  if (!a || !ruido) return
  const t = a.currentTime
  const s = a.createBufferSource()
  const f = a.createBiquadFilter()
  const g = a.createGain()
  s.buffer = ruido
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(a.destination)
  s.start(t)
  s.stop(t + dur + 0.03)
}

export type Sonido = 'toque' | 'tick' | 'levantar' | 'soltar' | 'pop' | 'ficha' | 'error' | 'hoja' | 'giro' | 'exito' | 'timbre'

// x (0 a 1) sube el tono: el avance de un número que corre, la velocidad de la tuerca
export function sonar(tipo: Sonido, x = 0) {
  if (!encendido || typeof window === 'undefined') return
  try {
    switch (tipo) {
      case 'toque':
        return tono(430, 360, 0.05, 0.04, 'triangle')
      case 'tick':
        return tono(1900, 1500, 0.025, 0.03, 'triangle')
      case 'levantar':
        soplo(700, 2400, 0.1, 0.08)
        return tono(260, 440, 0.08, 0.04)
      case 'soltar':
        tono(210, 90, 0.1, 0.11)
        return soplo(900, 300, 0.06, 0.05)
      case 'pop':
        return tono(520 * (1 + x), 980 * (1 + x), 0.09, 0.07)
      case 'ficha':
        return tono(900 + 900 * x, 1100 + 900 * x, 0.035, 0.03, 'triangle')
      case 'error':
        tono(160, 140, 0.09, 0.05, 'square')
        return tono(160, 130, 0.09, 0.05, 'square', 0.11)
      case 'hoja':
        return soplo(400, 1400, 0.16, 0.05, 0.8)
      case 'giro':
        return tono(1500 + x * 500, 1300 + x * 500, 0.018, 0.03, 'triangle')
      case 'exito':
        tono(660, 660, 0.1, 0.06)
        return tono(990, 990, 0.18, 0.06, 'sine', 0.09)
      case 'timbre':
        soplo(320, 120, 0.09, 0.14, 0.7)
        return tono(130, 70, 0.11, 0.13)
    }
  } catch {
    // Sin audio no pasa nada
  }
}

export function vibrar(patron: number | number[]) {
  if (!encendido) return
  try {
    navigator.vibrate?.(patron)
  } catch {
    // No hay vibración en este dispositivo
  }
}

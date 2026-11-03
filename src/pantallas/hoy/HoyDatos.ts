import { useEffect, useState } from 'react'
import type { Persona } from '../../datos/consultas.ts'
import { asistentesDe, estaAllaEse, miLugar, type Asistente, type Evento, type NotaReunion } from '../../datos/eventos.ts'
import { ahora as ahoraIso, diaEn } from '../../datos/fechas.ts'

// Qué muestra Hoy según tus fechas: antes de llegar, durante tu estadía o después de volver
export type Momento = 'sinFechas' | 'antes' | 'durante' | 'despues'

export function momentoDelViaje({ llega, vuelve }: Pick<Persona, 'llega' | 'vuelve'>, hoy: string): Momento {
  if (!llega || !vuelve) return 'sinFechas'
  if (hoy < llega) return 'antes'
  if (hoy > vuelve) return 'despues'
  return 'durante'
}

const ms = (momento: string) => Date.parse(momento)
const porInicio = (a: Evento, b: Evento) => ms(a.inicio) - ms(b.inicio)

// La hora de ahora, al minuto (en desarrollo, ?hoy= la deja fija)
export function useAhora(): number {
  const [ahora, setAhora] = useState(() => ms(ahoraIso()))
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(ms(ahoraIso())), 30_000)
    return () => window.clearInterval(reloj)
  }, [])
  return ahora
}

function vas(evento: Evento, asistentes: Asistente[], yo: string): boolean {
  return miLugar(evento.id, asistentes, yo)?.estado === 'va'
}

// Cómo se ve cada parada: lo que ya terminó se apaga; la próxima va destacada
export type EstadoParada = 'pasada' | 'enCurso' | 'proxima' | 'futura'
export type Parada = { evento: Evento; estado: EstadoParada }

// Tu día: tus eventos de hoy en orden. "Ahora" va justo antes de la parada número ahoraEn.
export function tuDia(eventos: Evento[], asistentes: Asistente[], yo: string, hoy: string, ahora: number): { paradas: Parada[]; ahoraEn: number } {
  const mios = eventos.filter((e) => diaEn(e.inicio) === hoy && vas(e, asistentes, yo)).sort(porInicio)
  const ahoraEn = mios.filter((e) => ms(e.inicio) <= ahora).length
  const paradas = mios.map((evento, i): Parada => ({
    evento,
    estado: ms(evento.fin) <= ahora ? 'pasada' : i < ahoraEn ? 'enCurso' : i === ahoraEn ? 'proxima' : 'futura',
  }))
  return { paradas, ahoraEn }
}

// Lo próximo antes del viaje: los primeros eventos a los que vas, solo dentro de tu estadía
export function loProximo(eventos: Evento[], asistentes: Asistente[], persona: Persona, ahora: number, cuantos = 2): Parada[] {
  return eventos
    .filter((e) => ms(e.fin) > ahora && estaAllaEse(persona, e.inicio) && vas(e, asistentes, persona.id))
    .sort(porInicio)
    .slice(0, cuantos)
    .map((evento, i) => ({ evento, estado: i === 0 ? 'proxima' : 'futura' }))
}

// Cuántos cupos quedan; null si no tiene límite
export function cuposLibres(evento: Evento, asistentes: Asistente[]): number | null {
  if (evento.modo !== 'con_cupo' || evento.cupos === null) return null
  return Math.max(0, evento.cupos - asistentesDe(evento.id, asistentes).van.length)
}

// También hoy en el grupo: lo de hoy que todavía no empieza y al que te puedes sumar
export function tambienHoy(eventos: Evento[], asistentes: Asistente[], yo: string, hoy: string, ahora: number): Evento[] {
  return eventos
    .filter((e) => {
      if (diaEn(e.inicio) !== hoy || ms(e.inicio) <= ahora || e.modo === 'cerrado') return false
      // Si estás en la lista de espera también va aquí, con tu puesto
      const lugar = miLugar(e.id, asistentes, yo)
      return lugar ? lugar.estado === 'espera' : cuposLibres(e, asistentes) !== 0
    })
    .sort(porInicio)
}

// Eventos para todos que todavía no confirmas, dentro de tu estadía. Durante el viaje, los de hoy ya están en "También hoy".
export function porConfirmar(eventos: Evento[], asistentes: Asistente[], persona: Persona, ahora: number, salvoElDia: string | null): Evento[] {
  return eventos
    .filter((e) => e.modo === 'para_todos' && ms(e.inicio) > ahora && estaAllaEse(persona, e.inicio) && diaEn(e.inicio) !== salvoElDia && !vas(e, asistentes, persona.id))
    .sort(porInicio)
}

// Una nota cuenta cuando dice algo (igual que en el contacto)
export function tieneNota(evento: string, notas: NotaReunion[], yo: string): boolean {
  return notas.some((n) => n.evento === evento && n.autor === yo && Boolean(n.aprendi?.trim() || n.sigue?.trim()))
}

// Reuniones a las que fuiste y que todavía no tienen tu nota
export function reunionesSinNota(eventos: Evento[], asistentes: Asistente[], notas: NotaReunion[], yo: string, ahora: number): Evento[] {
  return eventos.filter((e) => e.tipo === 'reunion' && ms(e.fin) <= ahora && vas(e, asistentes, yo) && !tieneNota(e.id, notas, yo)).sort(porInicio)
}

// Minutos que faltan para un momento (al menos 1 si todavía no llega)
export function minutosHasta(momento: string, ahora: number): number {
  return Math.ceil((ms(momento) - ahora) / 60_000)
}

const plano = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// "Philz Coffee, Palo Alto": el lugar y su ciudad. Si el lugar repite el título o la calle, la dirección.
export function dondeCorto({ titulo, lugar, direccion }: Pick<Evento, 'titulo' | 'lugar' | 'direccion'>): string {
  if (!lugar) return direccion ?? ''
  if (!direccion) return lugar
  const [l, t, d] = [plano(lugar), plano(titulo), plano(direccion)]
  if (l.includes(t) || t.includes(l) || d.startsWith(l)) return direccion
  const ciudad = direccion.split(',').at(-1)?.trim()
  return ciudad && !l.includes(plano(ciudad)) && ciudad !== direccion ? `${lugar}, ${ciudad}` : lugar
}

// Los otros que van, en orden de llegada
export function otrosQueVan(evento: string, asistentes: Asistente[], yo: string): string[] {
  return asistentesDe(evento, asistentes)
    .van.map((a) => a.persona)
    .filter((p) => p !== yo)
}

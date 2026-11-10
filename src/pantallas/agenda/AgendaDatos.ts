import { useEffect, useState } from 'react'
import type { Persona } from '../../datos/consultas.ts'
import { asistentesDe, estaAllaEse, type Asistente, type Evento, type Ocupado } from '../../datos/eventos.ts'
import { idiomaActual } from '../../datos/idioma.ts'
import { ahora, conMayuscula, diaEn, diasEntre, hora, sumarDias, type Ventana } from '../../datos/fechas.ts'

// Lo que muestran las vistas de la Agenda: eventos y ratos ocupados con su día y sus minutos en California.

export type Vista = 'dia' | 'semana' | 'mes'
export type Estado = 'vas' | 'voy' | 'tomar' | 'lleno' | 'cerrada' | 'espera' | 'pasado' | 'afuera'

type Comun = {
  id: string
  titulo: string
  inicio: string
  fin: string
  dia: string
  // Minutos desde la medianoche del día en California
  desde: number
  hasta: number
  pasada: boolean
}
export type PiezaEvento = Comun & { tipo: 'evento'; evento: Evento; estado: Estado; mio: boolean; proxima: boolean; van: string[] }
export type PiezaOcupado = Comun & { tipo: 'ocupado'; ocupado: Ocupado }
export type Pieza = PiezaEvento | PiezaOcupado

function minutos(momento: string, dia: string): number {
  const [h, m] = hora(momento).split(':').map(Number)
  return (diasEntre(dia, diaEn(momento)) - 1) * 1440 + h * 60 + m
}

function comun(id: string, titulo: string, inicio: string, fin: string, ahoraMs: number): Comun {
  const dia = diaEn(inicio)
  const desde = minutos(inicio, dia)
  return { id, titulo, inicio, fin, dia, desde, hasta: Math.max(minutos(fin, dia), desde), pasada: Date.parse(fin) <= ahoraMs }
}

// En los días fuera de tu estadía dice "No estás allá" en vez de lo que podrías hacer
function estadoDe(evento: Evento, yo: Persona, pasada: boolean, voy: boolean, espero: boolean, van: number): Estado {
  if (!estaAllaEse(yo, evento.inicio)) return 'afuera'
  if (pasada) return 'pasado'
  if (voy) return 'vas'
  if (espero) return 'espera'
  if (evento.modo === 'cerrado') return 'cerrada'
  if (evento.modo === 'para_todos') return 'voy'
  return evento.cupos !== null && van >= evento.cupos ? 'lleno' : 'tomar'
}

// "Próxima" es lo siguiente a lo que vas (o lo que está pasando): va en acento
export function armarPiezas(eventos: Evento[], asistentes: Asistente[], ocupados: Ocupado[], yo: Persona, ahoraIso: string): Pieza[] {
  const ahoraMs = Date.parse(ahoraIso)
  const piezas: Pieza[] = []
  let hayProxima = false
  for (const evento of [...eventos].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))) {
    const base = comun(evento.id, evento.titulo, evento.inicio, evento.fin, ahoraMs)
    const { van, espera } = asistentesDe(evento.id, asistentes)
    const mio = van.some((a) => a.persona === yo.id)
    const proxima = mio && !base.pasada && !hayProxima
    if (proxima) hayProxima = true
    const estado = estadoDe(evento, yo, base.pasada, mio, espera.some((a) => a.persona === yo.id), van.length)
    piezas.push({ ...base, tipo: 'evento', evento, estado, mio, proxima, van: van.map((a) => a.persona) })
  }
  for (const ocupado of ocupados) piezas.push({ ...comun(ocupado.id, ocupado.titulo, ocupado.inicio, ocupado.fin, ahoraMs), tipo: 'ocupado', ocupado })
  return piezas.sort((a, b) => a.dia.localeCompare(b.dia) || a.desde - b.desde || a.hasta - b.hasta)
}

// "A los que voy": los tuyos y tus ratos ocupados
export function deLosQueVoy(pieza: Pieza): boolean {
  return pieza.tipo === 'ocupado' || pieza.mio
}

export function porDia(piezas: Pieza[]): Map<string, Pieza[]> {
  const dias = new Map<string, Pieza[]>()
  for (const pieza of piezas) dias.set(pieza.dia, [...(dias.get(pieza.dia) ?? []), pieza])
  return dias
}

// "440 N Wolfe Rd, Sunnyvale" → "Sunnyvale". El estado, el código postal y el país no dicen nada.
export function ciudad(direccion: string | null): string | null {
  const partes = (direccion ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (partes.length < 2) return null
  while (partes.length > 1 && /^([A-Z]{2}(\s+\d{5}(-\d{4})?)?|\d{5}|USA|United States|EE\.? ?UU\.?|Estados Unidos)$/i.test(partes[partes.length - 1])) partes.pop()
  return partes[partes.length - 1]
}

// "Plug and Play Tech Center, Sunnyvale"
export function lugarYCiudad(evento: Evento): string {
  const partes = [evento.lugar?.trim(), ciudad(evento.direccion)].filter((p): p is string => Boolean(p))
  return [...new Set(partes)].join(', ')
}

// Las horas que muestra la semana: de 8 a 22, o más si hay algo antes o después
export function horasDe(piezas: Pieza[]): [number, number] {
  let desde = 8
  let hasta = 22
  for (const p of piezas) {
    desde = Math.min(desde, Math.floor(p.desde / 60))
    hasta = Math.max(hasta, Math.ceil(Math.min(p.hasta, 1440) / 60))
  }
  return [desde, hasta]
}

// Lo que se topa va lado a lado: cada pieza dice en qué columna va y entre cuántas
export function acomodar<T extends { desde: number; hasta: number }>(piezas: T[]): { pieza: T; columna: number; columnas: number }[] {
  const salida: { pieza: T; columna: number; columnas: number }[] = []
  let grupo: { pieza: T; columna: number; columnas: number }[] = []
  let finales: number[] = []
  let finGrupo = -1
  const cerrar = () => {
    for (const g of grupo) g.columnas = finales.length
    salida.push(...grupo)
    grupo = []
    finales = []
  }
  for (const pieza of [...piezas].sort((a, b) => a.desde - b.desde || b.hasta - a.hasta)) {
    const hasta = Math.max(pieza.hasta, pieza.desde + 15)
    if (pieza.desde >= finGrupo) cerrar()
    let columna = finales.findIndex((f) => f <= pieza.desde)
    if (columna < 0) {
      columna = finales.length
      finales.push(hasta)
    } else finales[columna] = hasta
    grupo.push({ pieza, columna, columnas: 1 })
    finGrupo = Math.max(finGrupo, hasta)
  }
  cerrar()
  return salida
}

// ---------- Días, semanas y meses (solo los del viaje) ----------
export function lunesDe(dia: string): string {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay()
  return sumarDias(dia, -((semana + 6) % 7))
}

export function semanaDe(dia: string): string[] {
  const lunes = lunesDe(dia)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

// El mismo día en otro mes (el 31 pasa a ser el último del mes)
function sumarMeses(dia: string, meses: number): string {
  const [ano, mes, numero] = dia.split('-').map(Number)
  const primero = new Date(Date.UTC(ano, mes - 1 + meses, 1))
  const largo = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth(), Math.min(numero, largo))).toISOString().slice(0, 10)
}

// El mes en semanas completas, de lunes a domingo
export function diasDelMes(dia: string): string[] {
  const primero = `${dia.slice(0, 7)}-01`
  const ultimo = sumarDias(sumarMeses(primero, 1), -1)
  const desde = lunesDe(primero)
  return Array.from({ length: diasEntre(desde, sumarDias(lunesDe(ultimo), 6)) }, (_, i) => sumarDias(desde, i))
}

// Se abre en hoy; antes del viaje, en el día que llegas; después, en el que volviste
export function diaInicial(yo: Pick<Persona, 'llega' | 'vuelve'>, hoy: string, viaje: Ventana): string {
  if (hoy < viaje.desde) return yo.llega ?? viaje.desde
  if (hoy > viaje.hasta) return yo.vuelve ?? viaje.hasta
  return hoy
}

// Sin límites: se puede ir a cualquier día, semana o mes, antes, durante o después del viaje
export function mover(vista: Vista, dia: string, paso: number): string {
  return vista === 'dia' ? sumarDias(dia, paso) : vista === 'semana' ? sumarDias(dia, 7 * paso) : sumarMeses(dia, paso)
}

// Los días que se ven en cada vista
export function diasDe(vista: Vista, dia: string): string[] {
  if (vista === 'dia') return [dia]
  if (vista === 'semana') return semanaDe(dia)
  return diasDelMes(dia).filter((d) => d.slice(0, 7) === dia.slice(0, 7))
}

const formatosMes = {
  es: new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
}

// "Enero de 2027" o "January 2027"
export function tituloMes(dia: string): string {
  return conMayuscula(formatosMes[idiomaActual()].format(new Date(`${dia}T00:00:00Z`)))
}

// La hora de ahora, al minuto, para que "ahora" avance solo
export function useAhora(): string {
  const [valor, setValor] = useState(ahora)
  useEffect(() => {
    const reloj = window.setInterval(() => setValor(ahora()), 30_000)
    return () => window.clearInterval(reloj)
  }, [])
  return valor
}

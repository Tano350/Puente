// Fechas del viaje en español. Las fechas de estadía son días sin hora:
// se leen en UTC para que no se corran con la zona horaria del dispositivo.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Enero y febrero de 2027: el rango que muestran los gráficos y que aceptan las fechas
export const VIAJE = { desde: '2027-01-01', hasta: '2027-02-28', dias: 59 }

const DIA_MS = 86_400_000
const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`)

// Solo en desarrollo: ?hoy=2027-01-12 hace como si fuera ese día, para revisar las pantallas del viaje
const hoyDePrueba = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('hoy') : null

export function sumarDias(iso: string, dias: number): string {
  return new Date(aFecha(iso).getTime() + dias * DIA_MS).toISOString().slice(0, 10)
}

// Días de a hasta b, contando los dos
export function diasEntre(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / DIA_MS) + 1
}

// Posición del día dentro de enero y febrero (0 = 1 de enero)
export function indiceEnElViaje(iso: string): number {
  return diasEntre(VIAJE.desde, iso) - 1
}

export function diaCorto(iso: string): string {
  const f = aFecha(iso)
  return `${f.getUTCDate()} ${MESES_CORTOS[f.getUTCMonth()]}`
}

export function diaConSemana(iso: string): string {
  const f = aFecha(iso)
  return `${DIAS_CORTOS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES_CORTOS[f.getUTCMonth()]}`
}

export function diaLargo(iso: string): string {
  const f = aFecha(iso)
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`
}

// "viernes 15", para lo que pasa en los próximos días
export function diaDeLaSemana(iso: string): string {
  const f = aFecha(iso)
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()}`
}

export function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function rangoCorto(a: string, b: string): string {
  return `${diaCorto(a)} – ${diaCorto(b)}`
}

// "5 al 30 de enero" o "16 de enero al 14 de febrero"
export function rango(a: string, b: string): string {
  const fa = aFecha(a)
  const fb = aFecha(b)
  if (fa.getUTCMonth() === fb.getUTCMonth()) return `${fa.getUTCDate()} al ${fb.getUTCDate()} de ${MESES[fb.getUTCMonth()]}`
  return `${fa.getUTCDate()} de ${MESES[fa.getUTCMonth()]} al ${fb.getUTCDate()} de ${MESES[fb.getUTCMonth()]}`
}

export function rangoLargo(a: string, b: string): string {
  return `Del ${rango(a, b)}`
}

// El día de hoy en California, donde se hace el viaje
export function hoyEnCalifornia(): string {
  return hoyDePrueba ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

// El día de hoy donde está el dispositivo: en Chile antes del viaje, en California durante
export function hoyAqui(): string {
  return hoyDePrueba ?? new Intl.DateTimeFormat('en-CA').format(new Date())
}

// El día de un momento guardado (fecha y hora), donde está el dispositivo
export function diaLocal(momento: string): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date(momento))
}

export type Estadia = { tipo: 'sinFechas' } | { tipo: 'llega'; texto: string } | { tipo: 'alla'; texto: string } | { tipo: 'volvio'; texto: string }

// Cómo se ve la estadía de alguien hoy: "Llega el 16 ene", "Allá" o "Volvió"
export function estadia(llega: string | null, vuelve: string | null, hoy = hoyEnCalifornia()): Estadia {
  if (!llega || !vuelve) return { tipo: 'sinFechas' }
  if (hoy < llega) return { tipo: 'llega', texto: `Llega el ${diaCorto(llega)}` }
  if (hoy > vuelve) return { tipo: 'volvio', texto: 'Volvió' }
  return { tipo: 'alla', texto: 'Allá' }
}

// ---------- Horas de los eventos: se guardan en UTC y se muestran en California (o en Chile) ----------
export const CALIFORNIA = 'America/Los_Angeles'
export const CHILE = 'America/Santiago'

const formatoHora = new Map<string, Intl.DateTimeFormat>()
const formatoDia = new Map<string, Intl.DateTimeFormat>()

// "09:30"
export function hora(momento: string, zona = CALIFORNIA): string {
  if (!formatoHora.has(zona)) formatoHora.set(zona, new Intl.DateTimeFormat('es-CL', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))
  return formatoHora.get(zona)!.format(new Date(momento))
}

// El día (AAAA-MM-DD) de un momento, en esa zona
export function diaEn(momento: string, zona = CALIFORNIA): string {
  if (!formatoDia.has(zona)) formatoDia.set(zona, new Intl.DateTimeFormat('en-CA', { timeZone: zona }))
  return formatoDia.get(zona)!.format(new Date(momento))
}

// Minutos que la zona va adelante de UTC en ese instante (en California, -480 en invierno)
function desfase(zona: string, instante: Date): number {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  )
  return (Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second) - instante.getTime()) / 60_000
}

// Un día y una hora de California (o de otra zona) como momento en UTC
export function momento(dia: string, horaYMinutos: string, zona = CALIFORNIA): string {
  const supuesto = new Date(`${dia}T${horaYMinutos}:00Z`)
  return new Date(supuesto.getTime() - desfase(zona, supuesto) * 60_000).toISOString()
}

// Ahora mismo en California, como momento (en desarrollo, ?hoy= lo fija a las 10:15 de ese día)
export function ahora(): string {
  return hoyDePrueba ? momento(hoyDePrueba, '10:15') : new Date().toISOString()
}

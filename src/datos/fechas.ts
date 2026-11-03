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

export function rangoCorto(a: string, b: string): string {
  return `${diaCorto(a)} – ${diaCorto(b)}`
}

export function rangoLargo(a: string, b: string): string {
  const fa = aFecha(a)
  const fb = aFecha(b)
  if (fa.getUTCMonth() === fb.getUTCMonth()) return `Del ${fa.getUTCDate()} al ${fb.getUTCDate()} de ${MESES[fb.getUTCMonth()]}`
  return `Del ${fa.getUTCDate()} de ${MESES[fa.getUTCMonth()]} al ${fb.getUTCDate()} de ${MESES[fb.getUTCMonth()]}`
}

// El día de hoy en California, donde se hace el viaje
export function hoyEnCalifornia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

export type Estadia = { tipo: 'sinFechas' } | { tipo: 'llega'; texto: string } | { tipo: 'alla'; texto: string } | { tipo: 'volvio'; texto: string }

// Cómo se ve la estadía de alguien hoy: "Llega el 16 ene", "Allá" o "Volvió"
export function estadia(llega: string | null, vuelve: string | null, hoy = hoyEnCalifornia()): Estadia {
  if (!llega || !vuelve) return { tipo: 'sinFechas' }
  if (hoy < llega) return { tipo: 'llega', texto: `Llega el ${diaCorto(llega)}` }
  if (hoy > vuelve) return { tipo: 'volvio', texto: 'Volvió' }
  return { tipo: 'alla', texto: 'Allá' }
}

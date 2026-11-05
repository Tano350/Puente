// Fechas del viaje, en español o en inglés según el idioma de la app. Las fechas de estadía son días sin hora:
// se leen en UTC para que no se corran con la zona horaria del dispositivo.
import { idiomaActual, type Idioma } from './idioma.ts'

const NOMBRES = {
  es: {
    meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    mesesCortos: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    dias: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    diasCortos: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  },
  en: {
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    mesesCortos: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    diasCortos: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
}

// "15th" en inglés
function ordinal(n: number): string {
  const resto = n % 100
  if (resto >= 11 && resto <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

// Palabras de la estadía que viven aquí porque las arma una función que no es un componente
const ESTADIA = {
  es: { llega: 'Llega el', volvio: 'Volvió', alla: 'Allá' },
  en: { llega: 'Arrives', volvio: 'Back', alla: 'There' },
}

// Un tramo de días (los dos bordes cuentan)
export type Ventana = { desde: string; hasta: string; dias: number }

// Enero y febrero de 2027: lo mínimo que muestran los gráficos y la Agenda. Las fechas de estadía son libres: si
// alguien llega antes o se va después, la ventana del viaje se estira para cubrirlo (ventanaDelViaje).
export const VIAJE: Ventana = { desde: '2027-01-01', hasta: '2027-02-28', dias: 59 }

const DIA_MS = 86_400_000
const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`)

// Solo en desarrollo: ?hoy=2027-01-12 hace como si fuera ese día, para revisar las pantallas del viaje
// (import.meta.env no existe al correr las pruebas con node)
const hoyDePrueba = import.meta.env?.DEV ? new URLSearchParams(window.location.search).get('hoy') : null

// Enero y febrero, estirados para cubrir las estadías de todos (también una que tenga solo llegada o solo vuelta)
export function ventanaDelViaje(estadias: { llega: string | null; vuelve: string | null }[]): Ventana {
  let desde = VIAJE.desde
  let hasta = VIAJE.hasta
  for (const { llega, vuelve } of estadias) {
    for (const dia of [llega, vuelve]) {
      if (!dia) continue
      if (dia < desde) desde = dia
      if (dia > hasta) hasta = dia
    }
  }
  return { desde, hasta, dias: diasEntre(desde, hasta) }
}

// Los meses que cubre una ventana, con cuántos de sus días caen dentro: los rótulos de los gráficos ("Enero", "Febrero"…)
export function mesesDe(ventana: Ventana, idioma: Idioma = idiomaActual()): { nombre: string; dias: number }[] {
  const meses: { nombre: string; dias: number }[] = []
  let dia = ventana.desde
  while (dia <= ventana.hasta) {
    const f = aFecha(dia)
    const finDeMes = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    const fin = finDeMes < ventana.hasta ? finDeMes : ventana.hasta
    meses.push({ nombre: conMayuscula(NOMBRES[idioma].meses[f.getUTCMonth()]), dias: diasEntre(dia, fin) })
    dia = sumarDias(fin, 1)
  }
  return meses
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aFecha(iso).getTime() + dias * DIA_MS).toISOString().slice(0, 10)
}

// Días de a hasta b, contando los dos
export function diasEntre(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / DIA_MS) + 1
}

// Posición del día dentro de la ventana del viaje (0 = su primer día; por omisión, el 1 de enero)
export function indiceEnElViaje(iso: string, ventana: Ventana = VIAJE): number {
  return diasEntre(ventana.desde, iso) - 1
}

// "16 ene" o "Jan 16"
export function diaCorto(iso: string, idioma: Idioma = idiomaActual()): string {
  const f = aFecha(iso)
  const mes = NOMBRES[idioma].mesesCortos[f.getUTCMonth()]
  return idioma === 'en' ? `${mes} ${f.getUTCDate()}` : `${f.getUTCDate()} ${mes}`
}

// "Vie 15 ene" o "Fri, Jan 15"
export function diaConSemana(iso: string, idioma: Idioma = idiomaActual()): string {
  const f = aFecha(iso)
  const dia = NOMBRES[idioma].diasCortos[f.getUTCDay()]
  return idioma === 'en' ? `${dia}, ${diaCorto(iso, idioma)}` : `${dia} ${diaCorto(iso, idioma)}`
}

// "viernes 15 de enero" o "Friday, January 15"
export function diaLargo(iso: string, idioma: Idioma = idiomaActual()): string {
  const f = aFecha(iso)
  const n = NOMBRES[idioma]
  if (idioma === 'en') return `${n.dias[f.getUTCDay()]}, ${n.meses[f.getUTCMonth()]} ${f.getUTCDate()}`
  return `${n.dias[f.getUTCDay()]} ${f.getUTCDate()} de ${n.meses[f.getUTCMonth()]}`
}

// "viernes 15" o "Friday the 15th", para lo que pasa en los próximos días
export function diaDeLaSemana(iso: string, idioma: Idioma = idiomaActual()): string {
  const f = aFecha(iso)
  const dia = NOMBRES[idioma].dias[f.getUTCDay()]
  return idioma === 'en' ? `${dia} the ${ordinal(f.getUTCDate())}` : `${dia} ${f.getUTCDate()}`
}

export function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function rangoCorto(a: string, b: string, idioma: Idioma = idiomaActual()): string {
  return `${diaCorto(a, idioma)} – ${diaCorto(b, idioma)}`
}

// "5 al 30 de enero" o "16 de enero al 14 de febrero"; en inglés, "January 5 to 30" o "January 16 to February 14"
export function rango(a: string, b: string, idioma: Idioma = idiomaActual()): string {
  const fa = aFecha(a)
  const fb = aFecha(b)
  const { meses } = NOMBRES[idioma]
  const mismoMes = fa.getUTCMonth() === fb.getUTCMonth()
  if (idioma === 'en') {
    return mismoMes
      ? `${meses[fb.getUTCMonth()]} ${fa.getUTCDate()} to ${fb.getUTCDate()}`
      : `${meses[fa.getUTCMonth()]} ${fa.getUTCDate()} to ${meses[fb.getUTCMonth()]} ${fb.getUTCDate()}`
  }
  if (mismoMes) return `${fa.getUTCDate()} al ${fb.getUTCDate()} de ${meses[fb.getUTCMonth()]}`
  return `${fa.getUTCDate()} de ${meses[fa.getUTCMonth()]} al ${fb.getUTCDate()} de ${meses[fb.getUTCMonth()]}`
}

export function rangoLargo(a: string, b: string, idioma: Idioma = idiomaActual()): string {
  return idioma === 'en' ? rango(a, b, idioma) : `Del ${rango(a, b, idioma)}`
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
  const palabras = ESTADIA[idiomaActual()]
  if (hoy < llega) return { tipo: 'llega', texto: `${palabras.llega} ${diaCorto(llega)}` }
  if (hoy > vuelve) return { tipo: 'volvio', texto: palabras.volvio }
  return { tipo: 'alla', texto: palabras.alla }
}

// ---------- Horas de los eventos: se guardan en UTC y se muestran en California (o en Chile) ----------
export const CALIFORNIA = 'America/Los_Angeles'
export const CHILE = 'America/Santiago'

const formatoHora = new Map<string, Intl.DateTimeFormat>()
const formatoDia = new Map<string, Intl.DateTimeFormat>()

// "09:30". Se queda en 24 horas en los dos idiomas: otras partes de la app leen este texto (los minutos de la
// Agenda, las horas de la Semana, el formulario de eventos) y 12 horas con AM/PM las rompería.
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

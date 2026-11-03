// El cruce entre la Agenda de Puente y el calendario "The Bridge" de cada uno. Recibe lo que hay en la base y lo leído
// de Google y devuelve qué hacer; no toca la red ni la base, así que se prueba solo.
// Puente manda: cada uno tiene en su calendario una copia de cada evento al que va, igual a lo que dice Puente.
// De esos calendarios solo se guarda cuándo está ocupado cada uno, sin títulos ni detalles. Si nada cambió, no hace nada.
import type { CalendarioGoogle, CuerpoGoogle, EventoGoogle, HoraGoogle } from './google.ts'

// Solo se cruza lo que cae en esta ventana, con los mismos bordes que usa Google al listar
export const DESDE = '2026-12-01T00:00:00Z'
export const HASTA = '2027-04-01T00:00:00Z'
export const ZONA = 'America/Los_Angeles'
const AGENDA = 'https://puente-2027.vercel.app/agenda/'
// Los calendarios del viaje se llaman como "Josefa: The Bridge" (el nombre puede ir antes o después, con cualquier mayúscula)
const DEL_VIAJE = /the\s*bridge/i

// Un evento no cancelado de public.eventos, con las horas en ISO
export type Evento = { id: string; titulo: string; lugar: string | null; direccion: string | null; notas: string | null; inicio: string; fin: string }
// Quién va a qué: asistentes con estado 'va' (no la lista de espera), de quienes siguen en Puente
export type Va = { evento: string; persona: string }
// De quién es cada calendario (public.calendarios, llenada a mano)
export type CalendarioDe = { persona: string; google_id: string }
export type Rato = { inicio: string; fin: string }
export type Ocupado = Rato & { persona: string }

export type Operacion =
  // En el calendario de alguien, siempre sin avisarle a nadie
  | { tipo: 'crear'; calendario: string; cuerpo: CuerpoGoogle }
  | { tipo: 'actualizar'; calendario: string; googleId: string; cuerpo: CuerpoGoogle }
  | { tipo: 'borrar'; calendario: string; googleId: string }
  // En Puente: los ratos ocupados de alguien se reemplazan todos juntos
  | { tipo: 'ocupados'; persona: string; ratos: Rato[] }

export type Entrada = {
  eventos: Evento[]
  van: Va[]
  calendarios: CalendarioDe[]
  ocupados: Ocupado[] // lo que ya está en public.ocupados_google
  listas: Map<string, EventoGoogle[]> // lo leído de cada calendario; si falta uno, no se pudo leer y queda como estaba
}

export function cruzar({ eventos, van, calendarios, ocupados, listas }: Entrada): Operacion[] {
  const ops: Operacion[] = []
  const vigentes = new Map(eventos.filter(enVentana).map((e) => [e.id, e]))
  for (const { persona, google_id: calendario } of calendarios) {
    const lista = listas.get(calendario)
    if (!lista) continue

    // 1. Una copia de cada evento al que va, tal como lo dice Puente
    const suyos = new Map<string, Evento>()
    for (const v of van) {
      const e = vigentes.get(v.evento)
      if (e && v.persona === persona) suyos.set(e.id, e)
    }
    const conCopia = new Set<string>()
    for (const g of lista) {
      const id = marca(g)
      if (id === undefined || !activo(g)) continue
      const e = suyos.get(id)
      // Ya no va (soltó el cupo, lo sacaron o quedó en espera), el evento se canceló o se borró, o la copia está repetida
      if (!e || conCopia.has(id)) {
        ops.push({ tipo: 'borrar', calendario, googleId: g.id })
        continue
      }
      conCopia.add(id)
      const cuerpo = aGoogle(e)
      if (!igual(g, cuerpo)) ops.push({ tipo: 'actualizar', calendario, googleId: g.id, cuerpo })
    }
    for (const e of suyos.values()) if (!conCopia.has(e.id)) ops.push({ tipo: 'crear', calendario, cuerpo: aGoogle(e) })

    // 2. Cuándo está ocupado según su calendario; se reescribe solo si cambió
    const ratos = ratosOcupados(lista)
    if (huella(ratos) !== huella(ocupados.filter((o) => o.persona === persona))) ops.push({ tipo: 'ocupados', persona, ratos })
  }
  // Quien ya no tiene calendario asignado deja de tener ratos ocupados de Google
  const conCalendario = new Set(calendarios.map((c) => c.persona))
  for (const persona of new Set(ocupados.map((o) => o.persona))) {
    if (!conCalendario.has(persona)) ops.push({ tipo: 'ocupados', persona, ratos: [] })
  }
  return ops
}

// Cómo queda una copia de un evento de Puente: sin invitados y con su marca
export function aGoogle(e: Evento): CuerpoGoogle {
  const lugar = [e.lugar, e.direccion].map(limpio).filter(Boolean).join(', ')
  const notas = limpio(e.notas)
  const enlace = AGENDA + e.id
  return {
    summary: e.titulo.trim(),
    ...(lugar ? { location: lugar } : {}),
    description: notas ? `${notas}\n\n${enlace}` : enlace,
    start: { dateTime: iso(e.inicio), timeZone: ZONA },
    end: { dateTime: iso(e.fin), timeZone: ZONA },
    status: 'confirmed',
    extendedProperties: { private: { puente: e.id } },
  }
}

// Lo que bloquea tiempo en un calendario: no las copias de Puente, no lo cancelado, no lo marcado como disponible.
// Lo de todo el día cuenta como días enteros de California.
export function ratosOcupados(lista: EventoGoogle[]): Rato[] {
  const ratos = new Map<string, Rato>()
  for (const g of lista) {
    if (marca(g) !== undefined || !activo(g) || g.transparency === 'transparent') continue
    const [inicio, fin] = g.start?.dateTime && g.end?.dateTime ? [g.start.dateTime, g.end.dateTime]
      : g.start?.date && g.end?.date ? [medianoche(g.start.date), medianoche(g.end.date)]
      : []
    if (inicio && fin && segundos(fin) > segundos(inicio)) ratos.set(`${iso(inicio)} ${iso(fin)}`, { inicio: iso(inicio), fin: iso(fin) })
  }
  return [...ratos.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin))
}

// Los calendarios del viaje que todavía no tienen dueño en public.calendarios, con su nombre completo, para asignarlos a mano
export function sinDueno(lista: CalendarioGoogle[], calendarios: CalendarioDe[]): { nombre: string; id: string }[] {
  const asignados = new Set(calendarios.map((c) => c.google_id))
  return lista
    .flatMap((c) => {
      const nombre = [c.summaryOverride, c.summary].find((s) => s && DEL_VIAJE.test(s))
      return nombre && !asignados.has(c.id) ? [{ nombre: nombre.trim(), id: c.id }] : []
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

// ¿La copia de Google dice lo mismo que Puente? Las horas se comparan como instantes: Google las devuelve con desfase
function igual(g: EventoGoogle, c: CuerpoGoogle): boolean {
  return (
    (g.status ?? 'confirmed') === 'confirmed' &&
    texto(g.summary) === texto(c.summary) &&
    texto(g.location) === texto(c.location) &&
    texto(g.description) === texto(c.description) &&
    mismaHora(g.start, c.start) &&
    mismaHora(g.end, c.end) &&
    !g.attendees?.length
  )
}

function mismaHora(h: HoraGoogle | undefined, deseada: { dateTime: string; timeZone: string }): boolean {
  return !!h?.dateTime && segundos(h.dateTime) === segundos(deseada.dateTime) && (!h.timeZone || h.timeZone === deseada.timeZone)
}

// La medianoche de California de una fecha: -08:00 en invierno, -07:00 desde el cambio de hora de marzo
const horaEnCalifornia = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' })
function medianoche(fecha: string): string {
  const invierno = `${fecha}T00:00:00-08:00`
  const instante = new Date(invierno)
  return Number.isNaN(instante.getTime()) || Number(horaEnCalifornia.format(instante)) === 0 ? invierno : `${fecha}T00:00:00-07:00`
}

// Siempre igual para el mismo conjunto de ratos, sin importar el orden ni cómo vengan escritas las horas
const huella = (ratos: Rato[]) => ratos.map((r) => `${segundos(r.inicio)}-${segundos(r.fin)}`).sort().join(' ')

const activo = (g: EventoGoogle) => g.status !== 'cancelled'
const marca = (g: EventoGoogle) => g.extendedProperties?.private?.puente
const segundos = (momento: string) => Math.floor(Date.parse(momento) / 1000)
const iso = (momento: string) => new Date(segundos(momento) * 1000).toISOString().replace('.000Z', 'Z')
const enVentana = (e: Evento) => segundos(e.fin) > segundos(DESDE) && segundos(e.inicio) < segundos(HASTA)
const texto = (s: string | undefined) => (s ?? '').replace(/\r\n?/g, '\n').trim()

function limpio(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

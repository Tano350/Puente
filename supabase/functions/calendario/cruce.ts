// El cruce entre la Agenda de Puente y el calendario "The Bridge" de cada uno. Recibe lo que hay en la base y lo leído
// de Google y devuelve qué hacer; no toca la red ni la base, así que se prueba solo.
// Puente manda: cada uno tiene en su calendario una copia de cada evento al que va, igual a lo que dice Puente.
// De esos calendarios solo se guarda cuándo está ocupado cada uno, sin títulos ni detalles. Si nada cambió, no hace nada.
import type { CalendarioGoogle, CuerpoGoogle, EventoGoogle, HoraGoogle } from './google.ts'

// Solo se cruza lo que cae en esta ventana, con los mismos bordes que usa Google al listar
export const DESDE = '2026-12-01T00:00:00Z'
export const HASTA = '2027-04-01T00:00:00Z'
export const ZONA = 'America/Los_Angeles'
export type Ventana = { desde: string; hasta: string }
const DIA = 86_400_000

// La ventana que cubre DESDE–HASTA, las estadías de todos y todos los eventos de Puente, sean de la fecha que sean (la
// Agenda no limita las fechas). llegaMin y vuelveMax son días 'AAAA-MM-DD' (o null): la llegada más temprana y la vuelta
// más tardía. Se abre un día antes del primer día y dos después del último, en UTC, para que ningún día de California
// quede afuera. Sin fechas ni eventos (o con una fecha inválida), queda DESDE–HASTA.
export function ventanaDeCruce(llegaMin: string | null | undefined, vuelveMax: string | null | undefined, eventos: Pick<Evento, 'inicio' | 'fin'>[] = []): Ventana {
  const dia = (fecha: string | null | undefined) => (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? Date.parse(`${fecha}T00:00:00Z`) : NaN)
  const validos = (dias: number[]) => dias.filter((d) => !Number.isNaN(d))
  // Las horas de los eventos vienen en ISO y en UTC: su día UTC basta, con el margen de abajo
  const primeros = validos([dia(llegaMin), ...eventos.map((e) => dia(e.inicio.slice(0, 10)))])
  const ultimos = validos([dia(vuelveMax), ...eventos.map((e) => dia(e.fin.slice(0, 10)))])
  const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')
  const desde = primeros.length === 0 ? DESDE : iso(Math.min(Date.parse(DESDE), Math.min(...primeros) - DIA))
  const hasta = ultimos.length === 0 ? HASTA : iso(Math.max(Date.parse(HASTA), Math.max(...ultimos) + 2 * DIA))
  return { desde, hasta }
}
const AGENDA = 'https://puente-2027.vercel.app/agenda/'
// Los calendarios del viaje se llaman como "Josefa: The Bridge" (el nombre puede ir antes o después, con cualquier mayúscula)
const DEL_VIAJE = /the\s*bridge/i

// Un evento no cancelado de public.eventos, con las horas en ISO
export type Evento = { id: string; titulo: string; lugar: string | null; direccion: string | null; notas: string | null; inicio: string; fin: string }
// Quién va a qué: asistentes con estado 'va' (no la lista de espera), de quienes siguen en Puente
export type Va = { evento: string; persona: string }
// De quién es cada calendario (las filas de public.calendarios que quien administra asignó a alguien), con su permiso
export type CalendarioDe = { persona: string; google_id: string; permiso: string }
// Un calendario del viaje como se anota en public.calendarios (permiso: owner, writer, reader o freeBusyReader)
export type CalendarioDelViaje = { google_id: string; nombre: string; permiso: string }
export type CalendarioGuardado = CalendarioDelViaje & { persona: string | null }
export type CambiosDeCalendarios = {
  vistos: CalendarioDelViaje[] // los del viaje que aparecieron en esta vuelta
  nuevos: CalendarioDelViaje[]
  cambiados: CalendarioDelViaje[] // cambió el nombre o el permiso
  borrados: string[] // ya no aparecen y no tienen dueño
}
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
  ventana?: Ventana // lo que se cruza; sin ella, DESDE–HASTA
}

// Con permiso de dueño o para hacer cambios, Puente pone ahí las copias; con permiso solo para ver, únicamente lee cuándo
// está ocupado (las copias que ya estén se dejan como están). Con "solo libre u ocupado", events.list no sirve: se salta.
export const seLee = (permiso: string) => permiso === 'owner' || permiso === 'writer' || permiso === 'reader'
export const seEscribe = (permiso: string) => permiso === 'owner' || permiso === 'writer'

export function cruzar({ eventos, van, calendarios, ocupados, listas, ventana = { desde: DESDE, hasta: HASTA } }: Entrada): Operacion[] {
  const ops: Operacion[] = []
  const vigentes = new Map(eventos.filter((e) => enVentana(e, ventana)).map((e) => [e.id, e]))
  for (const { persona, google_id: calendario, permiso } of calendarios) {
    const lista = listas.get(calendario)
    if (!lista || !seLee(permiso)) continue
    // 1. Una copia de cada evento al que va, tal como lo dice Puente
    if (seEscribe(permiso)) {
      const suyos = new Map<string, Evento>()
      for (const v of van) {
        const e = vigentes.get(v.evento)
        if (e && v.persona === persona) suyos.set(e.id, e)
      }
      ops.push(...copias(calendario, lista, suyos))
    }
    // 2. Cuándo está ocupado según su calendario; se reescribe solo si cambió
    const ratos = ratosOcupados(lista)
    if (huella(ratos) !== huella(ocupados.filter((o) => o.persona === persona))) ops.push({ tipo: 'ocupados', persona, ratos })
  }
  // Quien ya no tiene un calendario que se pueda leer deja de tener ratos ocupados de Google
  const conCalendario = new Set(calendarios.filter((c) => seLee(c.permiso)).map((c) => c.persona))
  for (const persona of new Set(ocupados.map((o) => o.persona))) {
    if (!conCalendario.has(persona)) ops.push({ tipo: 'ocupados', persona, ratos: [] })
  }
  return ops
}

// Las copias en un calendario: una por cada evento al que va, igual a lo que dice Puente
function copias(calendario: string, lista: EventoGoogle[], suyos: Map<string, Evento>): Operacion[] {
  const ops: Operacion[] = []
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

// Los calendarios del viaje que ve quien administra y qué cambia en public.calendarios: los nuevos entran sin dueño,
// a los que cambiaron de nombre o de permiso se les anota, y todos los vistos quedan marcados como vistos ahora.
// Los que ya no aparecen se borran si no tienen dueño; los que tienen dueño se quedan (la app los muestra como no encontrados).
export function cruzarCalendarios(lista: CalendarioGoogle[], guardados: CalendarioGuardado[]): CambiosDeCalendarios {
  const antes = new Map(guardados.map((c) => [c.google_id, c]))
  const vistos = lista.flatMap((c) => {
    const nombre = [c.summaryOverride, c.summary].find((s) => s && DEL_VIAJE.test(s))
    return nombre ? [{ google_id: c.id, nombre: nombre.trim(), permiso: permiso(c.accessRole) }] : []
  })
  const ids = new Set(vistos.map((c) => c.google_id))
  return {
    vistos,
    nuevos: vistos.filter((c) => !antes.has(c.google_id)),
    cambiados: vistos.filter((c) => {
      const guardado = antes.get(c.google_id)
      return guardado !== undefined && (guardado.nombre !== c.nombre || guardado.permiso !== c.permiso)
    }),
    borrados: guardados.filter((c) => c.persona === null && !ids.has(c.google_id)).map((c) => c.google_id),
  }
}

// Si Google algún día dijera otro permiso, cuenta como el más bajo
const PERMISOS = ['owner', 'writer', 'reader', 'freeBusyReader']
const permiso = (rol: string | undefined) => (rol && PERMISOS.includes(rol) ? rol : 'freeBusyReader')

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
const enVentana = (e: Evento, v: Ventana) => segundos(e.fin) > segundos(v.desde) && segundos(e.inicio) < segundos(v.hasta)
const texto = (s: string | undefined) => (s ?? '').replace(/\r\n?/g, '\n').trim()

function limpio(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

// El cruce entre la Agenda de Puente y el calendario compartido de Google. Recibe las filas de "eventos" y los
// eventos de Google y devuelve qué hacer; no toca la red ni la base, así que se prueba solo.
// Puente manda en sus eventos (desde_google = false); Google manda en lo creado directo allá.
// Si nada cambió no devuelve nada, y lo que escribe en Puente no provoca escrituras en la vuelta siguiente.
import type { CuerpoGoogle, EventoGoogle, HoraGoogle } from './google.ts'

// Solo se cruza lo que cae en esta ventana, con los mismos bordes que usa Google al listar
export const DESDE = '2026-12-01T00:00:00Z'
export const HASTA = '2027-04-01T00:00:00Z'
export const ZONA = 'America/Los_Angeles'
const AGENDA = 'https://puente-2027.vercel.app/agenda/'

// Lo que se lee de public.eventos, con las horas en ISO
export type FilaEvento = {
  id: string
  titulo: string
  lugar: string | null
  direccion: string | null
  notas: string | null
  inicio: string
  fin: string
  google_id: string | null
  desde_google: boolean
  cancelado_en: string | null
}

// Lo que Puente toma de un evento de Google
type DeGoogle = Pick<FilaEvento, 'titulo' | 'lugar' | 'notas' | 'inicio' | 'fin'>

// Un evento creado directo en Google, como entra a Puente: para todos, sin cupos ni organizador
export type FilaNueva = DeGoogle & {
  google_id: string
  desde_google: true
  tipo: 'otro'
  modo: 'para_todos'
  cupos: null
  organizador: null
  creado_por: null
}

export type Cambios = Partial<DeGoogle> & { cancelado_en?: null }

export type Operacion =
  // En Google, siempre sin avisarle a nadie
  | { tipo: 'crear'; evento: string; cuerpo: CuerpoGoogle } // y guardar su google_id en Puente
  | { tipo: 'actualizar'; evento: string; googleId: string; cuerpo: CuerpoGoogle } // si Google ya no lo tiene, se crea de nuevo
  | { tipo: 'borrar'; googleId: string }
  // En Puente
  | { tipo: 'enlazar'; evento: string; googleId: string } // guardar el google_id que una vuelta anterior no alcanzó a guardar
  | { tipo: 'traer'; fila: FilaNueva }
  | { tipo: 'cambiar'; evento: string; cambios: Cambios }
  | { tipo: 'cancelar'; evento: string }

export function cruzar(filas: FilaEvento[], google: EventoGoogle[]): Operacion[] {
  const ops: Operacion[] = []
  const porId = new Map(google.map((e) => [e.id, e]))
  // Lo de Puente se reconoce por su marca o, si Google lo borró y ya no la muestra, por el google_id guardado
  const idsDePuente = new Set(filas.flatMap((f) => (!f.desde_google && f.google_id ? [f.google_id] : [])))
  const esDePuente = (e: EventoGoogle) => marca(e) !== undefined || idsDePuente.has(e.id)

  // 1. Cada evento vigente de Puente queda en Google tal como lo dice Puente
  const copias = new Set<string>()
  for (const f of filas) {
    if (f.desde_google || f.cancelado_en || !enVentana(f)) continue
    const cuerpo = aGoogle(f)
    // Su copia es la de su google_id; si no tiene, la que lleva su marca (de una vuelta que no alcanzó a guardar el id)
    const copia = f.google_id ? porId.get(f.google_id) : google.find((e) => activo(e) && marca(e) === f.id)
    if (!copia) {
      // Con google_id pero sin copia a la vista (borrada del todo o movida fuera de la ventana): se actualiza igual
      ops.push(f.google_id ? { tipo: 'actualizar', evento: f.id, googleId: f.google_id, cuerpo } : { tipo: 'crear', evento: f.id, cuerpo })
      continue
    }
    copias.add(copia.id)
    if (copia.id !== f.google_id) ops.push({ tipo: 'enlazar', evento: f.id, googleId: copia.id })
    if (!igual(copia, cuerpo)) ops.push({ tipo: 'actualizar', evento: f.id, googleId: copia.id, cuerpo })
  }
  // Lo que en Google dice ser de Puente y no es copia de un evento vigente (cancelado, borrado o repetido) se borra
  for (const e of google) {
    if (activo(e) && esDePuente(e) && !copias.has(e.id)) ops.push({ tipo: 'borrar', googleId: e.id })
  }

  // 2. Lo creado directo en Google entra a Puente y lo sigue
  const traidas = new Map<string, FilaEvento>()
  for (const f of filas) if (f.desde_google && f.google_id) traidas.set(f.google_id, f)
  const vistos = new Set<string>()
  for (const e of google) {
    if (!activo(e) || esDePuente(e)) continue
    const datos = deGoogle(e)
    if (!datos) continue // de todo el día o sin duración: no entra
    vistos.add(e.id)
    const f = traidas.get(e.id)
    if (!f) {
      ops.push({ tipo: 'traer', fila: { ...datos, google_id: e.id, desde_google: true, tipo: 'otro', modo: 'para_todos', cupos: null, organizador: null, creado_por: null } })
      continue
    }
    const cambios = diferencias(f, datos)
    if (Object.keys(cambios).length > 0) ops.push({ tipo: 'cambiar', evento: f.id, cambios })
  }
  // Si en Google se canceló, se borró o quedó de todo el día, en Puente se cancela (la fila queda)
  for (const [googleId, f] of traidas) {
    if (!f.cancelado_en && enVentana(f) && !vistos.has(googleId)) ops.push({ tipo: 'cancelar', evento: f.id })
  }
  return ops
}

// Cómo queda en Google un evento de Puente: sin invitados y con su marca
export function aGoogle(f: FilaEvento): CuerpoGoogle {
  const lugar = [f.lugar, f.direccion].map(limpio).filter(Boolean).join(', ')
  const notas = limpio(f.notas)
  const enlace = AGENDA + f.id
  return {
    summary: f.titulo.trim(),
    ...(lugar ? { location: lugar } : {}),
    description: notas ? `${notas}\n\n${enlace}` : enlace,
    start: { dateTime: iso(f.inicio), timeZone: ZONA },
    end: { dateTime: iso(f.fin), timeZone: ZONA },
    status: 'confirmed',
    extendedProperties: { private: { puente: f.id } },
  }
}

// Cómo entra a Puente un evento de Google; los de todo el día (sin hora) o sin duración no entran
function deGoogle(e: EventoGoogle): DeGoogle | null {
  const inicio = e.start?.dateTime
  const fin = e.end?.dateTime
  if (!inicio || !fin || !(segundos(fin) > segundos(inicio))) return null
  return { titulo: limpio(e.summary) ?? 'Sin título', lugar: limpio(e.location), notas: limpio(textoPlano(e.description)), inicio: iso(inicio), fin: iso(fin) }
}

function diferencias(f: FilaEvento, d: DeGoogle): Cambios {
  const cambios: Cambios = {}
  if (f.titulo !== d.titulo) cambios.titulo = d.titulo
  if (f.lugar !== d.lugar) cambios.lugar = d.lugar
  if (f.notas !== d.notas) cambios.notas = d.notas
  if (segundos(f.inicio) !== segundos(d.inicio)) cambios.inicio = d.inicio
  if (segundos(f.fin) !== segundos(d.fin)) cambios.fin = d.fin
  if (f.cancelado_en) cambios.cancelado_en = null // volvió a estar en Google
  return cambios
}

// ¿La copia de Google dice lo mismo que Puente? Las horas se comparan como instantes: Google las devuelve con desfase
function igual(e: EventoGoogle, c: CuerpoGoogle): boolean {
  return (
    (e.status ?? 'confirmed') === 'confirmed' &&
    marca(e) === c.extendedProperties.private.puente &&
    texto(e.summary) === texto(c.summary) &&
    texto(e.location) === texto(c.location) &&
    texto(e.description) === texto(c.description) &&
    mismaHora(e.start, c.start) &&
    mismaHora(e.end, c.end) &&
    !e.attendees?.length
  )
}

function mismaHora(h: HoraGoogle | undefined, deseada: { dateTime: string; timeZone: string }): boolean {
  return !!h?.dateTime && segundos(h.dateTime) === segundos(deseada.dateTime) && (!h.timeZone || h.timeZone === deseada.timeZone)
}

// Si alguien editó la descripción en la página de Google, viene en HTML; en Puente va como texto
function textoPlano(s: string | undefined): string | undefined {
  if (!s || !/<[a-z/!]/i.test(s)) return s
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

const activo = (e: EventoGoogle) => e.status !== 'cancelled'
const marca = (e: EventoGoogle) => e.extendedProperties?.private?.puente
const segundos = (momento: string) => Math.floor(Date.parse(momento) / 1000)
const iso = (momento: string) => new Date(segundos(momento) * 1000).toISOString().replace('.000Z', 'Z')
const enVentana = (f: FilaEvento) => segundos(f.fin) > segundos(DESDE) && segundos(f.inicio) < segundos(HASTA)
const texto = (s: string | undefined) => (s ?? '').replace(/\r\n?/g, '\n').trim()

function limpio(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

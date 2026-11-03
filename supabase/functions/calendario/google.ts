// Google Calendar para la función "calendario". Puente entra como quien administra: cambia el permiso que él dio
// (un refresh token guardado en Vault) por un token de acceso, y con fetch lee y escribe los calendarios de cada uno.
// Todo lo que escribe va con sendUpdates=none: Google nunca le manda un correo a nadie.

export type HoraGoogle = { dateTime?: string; date?: string; timeZone?: string }

// Un evento como lo devuelve Google (solo lo que usa Puente)
export type EventoGoogle = {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  start?: HoraGoogle
  end?: HoraGoogle
  transparency?: string
  attendees?: unknown[]
  extendedProperties?: { private?: Record<string, string> }
}

// Lo que Puente escribe en el calendario de cada uno: sin invitados y con la marca de Puente
export type CuerpoGoogle = {
  summary: string
  location?: string
  description: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  status: 'confirmed'
  extendedProperties: { private: { puente: string } }
}

// Un calendario de la lista de quien administra
export type CalendarioGoogle = { id: string; summary?: string; summaryOverride?: string }

// El cliente OAuth (el mismo de "Entrar con Google") y el permiso de quien administra
export type Acceso = { client_id: string; client_secret: string; refresh_token: string }
export type Pedir = (url: string, opciones?: RequestInit) => Promise<Response>
export type Google = ReturnType<typeof google>

export const RECONECTAR = 'Hay que volver a conectar Google Calendar.'
const TOKEN = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
const SIN_AVISOS = { sendUpdates: 'none' }

// Un error de Google con un mensaje corto que se puede mostrar: nunca lleva claves ni tokens
export class ErrorGoogle extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

// Cambia el permiso guardado por un token de acceso. Si Google ya no lo acepta (se revocó o venció), hay que reconectar.
export async function pedirToken(acceso: Acceso, pedir: Pedir = fetch): Promise<string> {
  const respuesta = await pedir(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', ...acceso }),
  })
  const datos = (await leerJson(respuesta)) as { access_token?: unknown; error?: unknown } | null
  if (respuesta.ok && typeof datos?.access_token === 'string') return datos.access_token
  if (datos?.error === 'invalid_grant') throw new ErrorGoogle(respuesta.status, RECONECTAR)
  throw new ErrorGoogle(respuesta.status, `Google no dio acceso (${respuesta.status}${motivo(datos)})`)
}

export function google(token: string, pedir: Pedir = fetch) {
  const eventos = (calendario: string, id?: string) => `${API}/calendars/${encodeURIComponent(calendario)}/events${id ? `/${encodeURIComponent(id)}` : ''}`

  // Llama a Google y siempre lee la respuesta completa
  async function llamar(metodo: string, url: string, consulta: Record<string, string>, cuerpo?: CuerpoGoogle) {
    const respuesta = await pedir(`${url}?${new URLSearchParams(consulta)}`, {
      method: metodo,
      headers: cuerpo ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    return { estado: respuesta.status, ok: respuesta.ok, datos: await leerJson(respuesta) }
  }

  function exigir(r: { estado: number; ok: boolean; datos: unknown }, que: string): unknown {
    if (!r.ok) throw new ErrorGoogle(r.estado, `Google respondió ${r.estado} al ${que}${motivo(r.datos)}`)
    return r.datos
  }

  // Todas las páginas de una lista. Una lista ilegible nunca se toma por vacía.
  async function todo<T>(url: string, consulta: Record<string, string>, que: string): Promise<T[]> {
    const items: T[] = []
    let pagina = ''
    do {
      const datos = exigir(await llamar('GET', url, pagina ? { ...consulta, pageToken: pagina } : consulta), que) as { items?: T[]; nextPageToken?: string } | null
      if (!datos) throw new ErrorGoogle(502, `Google respondió sin datos al ${que}`)
      items.push(...(datos.items ?? []))
      pagina = datos.nextPageToken ?? ''
    } while (pagina)
    return items
  }

  async function crear(calendario: string, cuerpo: CuerpoGoogle): Promise<void> {
    exigir(await llamar('POST', eventos(calendario), SIN_AVISOS, cuerpo), 'crear un evento')
  }

  return {
    // Los calendarios que ve quien administra (también los que tiene escondidos)
    calendarios: () => todo<CalendarioGoogle>(`${API}/users/me/calendarList`, { maxResults: '250', showHidden: 'true' }, 'listar los calendarios'),

    // Los eventos de un calendario en la ventana, cada repetición por separado (los borrados no vienen)
    listar: (calendario: string, desde: string, hasta: string) =>
      todo<EventoGoogle>(eventos(calendario), { singleEvents: 'true', timeMin: desde, timeMax: hasta, maxResults: '2500' }, 'leer un calendario'),

    crear,

    // La deja tal como lo dice Puente; si justo la borraron, la crea de nuevo
    async guardar(calendario: string, id: string, cuerpo: CuerpoGoogle): Promise<void> {
      const r = await llamar('PUT', eventos(calendario, id), SIN_AVISOS, cuerpo)
      if (noEsta(r.estado)) return crear(calendario, cuerpo)
      exigir(r, 'actualizar un evento')
    },

    async borrar(calendario: string, id: string): Promise<void> {
      const r = await llamar('DELETE', eventos(calendario, id), SIN_AVISOS)
      if (!noEsta(r.estado)) exigir(r, 'borrar un evento') // si ya no estaba, no hay nada que hacer
    },
  }
}

const noEsta = (estado: number) => estado === 404 || estado === 410

async function leerJson(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text()
  try {
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

// Lo que Google dice que salió mal, en corto
function motivo(datos: unknown): string {
  const { error, error_description } = (datos ?? {}) as { error?: string | { message?: string }; error_description?: string }
  const texto = typeof error === 'string' ? (error_description ?? error) : error?.message
  return texto ? `: ${String(texto).slice(0, 200)}` : ''
}

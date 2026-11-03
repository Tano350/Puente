// Google Calendar para la función "calendario". La cuenta de servicio entra con un JWT firmado con su llave (RS256,
// con WebCrypto) y el calendario compartido se lee y se escribe con fetch. Todo lo que escribe va con
// sendUpdates=none: Google nunca le manda un correo a nadie.

export type HoraGoogle = { dateTime?: string; date?: string; timeZone?: string }

// Un evento como lo devuelve Google (solo lo que usa Puente). Los borrados vienen con status "cancelled" y a veces solo con id.
export type EventoGoogle = {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  start?: HoraGoogle
  end?: HoraGoogle
  attendees?: unknown[]
  extendedProperties?: { private?: Record<string, string> }
}

// Lo que Puente escribe en Google: sin invitados y con la marca de Puente
export type CuerpoGoogle = {
  summary: string
  location?: string
  description: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  status: 'confirmed'
  extendedProperties: { private: { puente: string } }
}

export type CuentaDeServicio = { client_email: string; private_key: string }
export type Pedir = (url: string, opciones?: RequestInit) => Promise<Response>
export type Calendario = ReturnType<typeof calendario>

const TOKEN = 'https://oauth2.googleapis.com/token'
const ALCANCE = 'https://www.googleapis.com/auth/calendar'
const API = 'https://www.googleapis.com/calendar/v3/calendars/'
const SIN_AVISOS = { sendUpdates: 'none' }

// Un error de Google con un mensaje corto que se puede mostrar: nunca lleva claves ni tokens
export class ErrorGoogle extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

const utf8 = (texto: string) => new TextEncoder().encode(texto)
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// La llave viene en PEM (PKCS8). Si al pegarla los saltos de línea quedaron escritos como "\n", también sirve.
function pkcs8(pem: string) {
  const base64 = pem.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

// El JWT con que la cuenta de servicio pide acceso al calendario (vale una hora)
export async function firmarJwt(cuenta: CuentaDeServicio, ahora = Date.now()): Promise<string> {
  const iat = Math.floor(ahora / 1000)
  const cabecera = base64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const datos = base64url(utf8(JSON.stringify({ iss: cuenta.client_email, scope: ALCANCE, aud: TOKEN, iat, exp: iat + 3600 })))
  const llave = await crypto.subtle.importKey('pkcs8', pkcs8(cuenta.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, utf8(`${cabecera}.${datos}`))
  return `${cabecera}.${datos}.${base64url(new Uint8Array(firma))}`
}

// Cambia el JWT por un token de acceso
export async function pedirToken(cuenta: CuentaDeServicio, pedir: Pedir = fetch): Promise<string> {
  const respuesta = await pedir(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await firmarJwt(cuenta) }),
  })
  const datos = await leerJson(respuesta)
  const token = (datos as { access_token?: unknown } | null)?.access_token
  if (!respuesta.ok || typeof token !== 'string') throw new ErrorGoogle(respuesta.status, `Google no dio acceso al calendario (${respuesta.status}${motivo(datos)})`)
  return token
}

export function calendario(token: string, calendarioId: string, pedir: Pedir = fetch) {
  const eventos = `${API}${encodeURIComponent(calendarioId)}/events`

  // Llama a Google y siempre lee la respuesta completa
  async function llamar(metodo: string, ruta: string, consulta: Record<string, string>, cuerpo?: CuerpoGoogle) {
    const respuesta = await pedir(`${eventos}${ruta}?${new URLSearchParams(consulta)}`, {
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

  async function crear(cuerpo: CuerpoGoogle): Promise<EventoGoogle> {
    return exigir(await llamar('POST', '', SIN_AVISOS, cuerpo), 'crear un evento') as EventoGoogle
  }

  return {
    // Todos los eventos de la ventana: cada repetición por separado y también los borrados (con status "cancelled")
    async listar(desde: string, hasta: string): Promise<EventoGoogle[]> {
      const todos: EventoGoogle[] = []
      let pagina = ''
      do {
        const consulta: Record<string, string> = { singleEvents: 'true', showDeleted: 'true', timeMin: desde, timeMax: hasta, maxResults: '2500' }
        if (pagina) consulta.pageToken = pagina
        const datos = exigir(await llamar('GET', '', consulta), 'listar los eventos') as { items?: EventoGoogle[]; nextPageToken?: string } | null
        // Una lista ilegible nunca se toma por vacía: sería como si se hubiera borrado todo
        if (!datos) throw new ErrorGoogle(502, 'Google respondió sin la lista de eventos')
        todos.push(...(datos.items ?? []))
        pagina = datos.nextPageToken ?? ''
      } while (pagina)
      return todos
    },

    crear,

    // Lo deja tal como lo dice Puente. Si Google ya no lo tiene (o no lo revive), lo crea de nuevo: la respuesta trae el id nuevo.
    async guardar(id: string, cuerpo: CuerpoGoogle): Promise<EventoGoogle> {
      const r = await llamar('PUT', `/${encodeURIComponent(id)}`, SIN_AVISOS, cuerpo)
      if (noEsta(r.estado)) return crear(cuerpo)
      const evento = exigir(r, 'actualizar un evento') as EventoGoogle
      return evento.status === 'cancelled' ? crear(cuerpo) : evento
    },

    async borrar(id: string): Promise<void> {
      const r = await llamar('DELETE', `/${encodeURIComponent(id)}`, SIN_AVISOS)
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

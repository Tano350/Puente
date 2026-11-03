// Pruebas de una vuelta completa de index.ts con Deno, la base y Google de mentira. Lo más importante: con la
// sincronización apagada, Puente no lee ni escribe en el calendario de nadie. Corren con:
// node --test "supabase/functions/calendario/*.test.ts"
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

type Fila = Record<string, unknown>
type Escritura = { sql: string; valores: unknown[] }

// La base de mentira: responde las lecturas de index.ts y anota cada escritura
const base = {
  acceso: '1//permiso' as string | null,
  activa: false,
  calendarios: [] as Fila[],
  eventos: [] as Fila[],
  van: [] as Fila[],
  escrituras: [] as Escritura[],
}
// La cuenta de Google de mentira: anota cada pedido
const cuenta = {
  lista: [] as Fila[],
  aceptaPermiso: true,
  listaFalla: false,
  pedidos: [] as string[],
}

function responder(sql: string, valores: unknown[]): Fila[] {
  if (sql.startsWith('select decrypted_secret')) return base.acceso ? [{ decrypted_secret: base.acceso }] : []
  if (sql.startsWith('select google_id, nombre, permiso, persona')) return base.calendarios
  if (sql.startsWith('select activa')) return [{ activa: base.activa }]
  if (sql.startsWith('select id, titulo')) return base.eventos
  if (sql.startsWith('select a.evento')) return base.van
  if (sql.startsWith('select persona, google_id')) return base.calendarios.filter((c) => c.persona)
  if (sql.startsWith('select persona, inicio, fin')) return []
  assert.ok(!sql.startsWith('select'), `lectura inesperada: ${sql}`)
  base.escrituras.push({ sql, valores })
  return []
}

function postgresDeMentira() {
  const sql = (partes: unknown, ...valores: unknown[]): unknown =>
    Array.isArray(partes) && 'raw' in partes ? Promise.resolve(responder(partes.join('?').replace(/\s+/g, ' ').trim(), valores)) : { ayudante: partes }
  return Object.assign(sql, { begin: async (cuerpo: (tx: typeof sql) => Promise<unknown>) => cuerpo(sql), end: async () => {} })
}

const json = (estado: number, datos: unknown) => new Response(JSON.stringify(datos), { status: estado })
async function googleDeMentira(url: string | URL | Request, opciones: RequestInit = {}): Promise<Response> {
  const u = new URL(String(url))
  const metodo = opciones.method ?? 'GET'
  cuenta.pedidos.push(`${metodo} ${u.pathname}`)
  if (u.hostname === 'oauth2.googleapis.com') return cuenta.aceptaPermiso ? json(200, { access_token: 'ya29.de-prueba' }) : json(400, { error: 'invalid_grant' })
  if (u.pathname.endsWith('/calendarList')) return cuenta.listaFalla ? json(503, { error: { message: 'Backend Error' } }) : json(200, { items: cuenta.lista })
  if (metodo === 'GET') return json(200, { items: [] })
  return json(200, { id: 'nueva' })
}

const entorno: Record<string, string> = {
  CALENDARIO_CLAVE: 'clave-de-prueba',
  GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-del-cliente',
  SUPABASE_DB_URL: 'postgres://base-de-mentira',
}
let manejar: (pedido: Request) => Promise<Response> = async () => assert.fail('index.ts no llamó a Deno.serve')
registerHooks({
  resolve: (especificador, contexto, siguiente) =>
    especificador === 'npm:postgres@3.4.9'
      ? { url: 'data:text/javascript,export default () => globalThis.postgresDeMentira()', format: 'module', shortCircuit: true }
      : siguiente(especificador, contexto),
})
Object.assign(globalThis, {
  postgresDeMentira,
  fetch: googleDeMentira,
  Deno: { serve: (h: typeof manejar) => (manejar = h), env: { get: (nombre: string) => entorno[nombre] } },
})
console.log = () => {}
console.error = () => {}
await import('./index.ts')

async function correr() {
  base.escrituras = []
  cuenta.pedidos = []
  const respuesta = await manejar(new Request('https://ref.supabase.co/functions/v1/calendario', { method: 'POST', headers: { 'x-puente-clave': 'clave-de-prueba' } }))
  return { estado: respuesta.status, cuerpo: await respuesta.json() }
}

function preparar(activa: boolean) {
  Object.assign(base, {
    acceso: '1//permiso',
    activa,
    calendarios: [
      { google_id: 'cal-martina', nombre: 'Martina: The Bridge', permiso: 'writer', persona: 'martina' },
      { google_id: 'cal-viejo', nombre: 'Viejo: The Bridge', permiso: 'reader', persona: null },
    ],
    eventos: [{ id: 'p1', titulo: 'Visita a Google', lugar: null, direccion: null, notas: null, inicio: new Date('2027-01-12T18:00:00Z'), fin: new Date('2027-01-12T19:30:00Z') }],
    van: [{ evento: 'p1', persona: 'martina' }],
  })
  Object.assign(cuenta, {
    aceptaPermiso: true,
    listaFalla: false,
    lista: [
      { id: 'cal-martina', summary: 'Martina: The Bridge', accessRole: 'writer' },
      { id: 'cal-ignacio', summary: 'Ignacio: The bridge', accessRole: 'reader' },
      { id: 'personal', summary: 'tano@example.com', accessRole: 'owner' },
    ],
  })
}
const sqlDe = (escrituras: Escritura[]) => escrituras.map((e) => e.sql.split(' ').slice(0, 3).join(' '))

test('Apagada: anota los calendarios del viaje, pero no lee eventos ni escribe en Google ni en ocupados', async () => {
  preparar(false)
  assert.deepEqual(await correr(), {
    estado: 200,
    cuerpo: { calendarios: 2, activa: false, crear: 0, actualizar: 0, borrar: 0, ocupados: 0, errores: 0 },
  })
  assert.deepEqual(cuenta.pedidos, ['POST /token', 'GET /calendar/v3/users/me/calendarList'])
  assert.deepEqual(sqlDe(base.escrituras), [
    'insert into public.calendarios', // el de Ignacio, sin dueño
    'update public.calendarios set', // los vistos, vistos ahora
    'delete from public.calendarios', // el viejo, que no apareció y no tiene dueño
    'update public.sincronizacion set',
  ])
  assert.deepEqual(base.escrituras[0].valores, [{ ayudante: [{ google_id: 'cal-ignacio', nombre: 'Ignacio: The bridge', permiso: 'reader' }] }])
  assert.deepEqual(base.escrituras[1].valores, [{ ayudante: ['cal-martina', 'cal-ignacio'] }])
  assert.deepEqual(base.escrituras[2].valores, [{ ayudante: ['cal-viejo'] }])
  assert.deepEqual(base.escrituras[3].valores, [0])
})

test('Encendida: además lee los calendarios asignados y escribe las copias', async () => {
  preparar(true)
  assert.deepEqual(await correr(), {
    estado: 200,
    cuerpo: { calendarios: 2, activa: true, crear: 1, actualizar: 0, borrar: 0, ocupados: 0, errores: 0 },
  })
  assert.deepEqual(cuenta.pedidos, [
    'POST /token',
    'GET /calendar/v3/users/me/calendarList',
    'GET /calendar/v3/calendars/cal-martina/events',
    'POST /calendar/v3/calendars/cal-martina/events',
  ])
  assert.ok(!base.escrituras.some((e) => e.sql.includes('ocupados_google')), 'no había ratos ocupados que cambiar')
})

test('Encendida: no lee los de "solo libre u ocupado" ni escribe en los "solo para ver", y eso no cuenta como error', async () => {
  preparar(true)
  base.calendarios = [
    { google_id: 'cal-martina', nombre: 'Martina: The Bridge', permiso: 'writer', persona: 'martina' },
    { google_id: 'cal-beto', nombre: 'Beto: The Bridge', permiso: 'reader', persona: 'beto' },
    { google_id: 'cal-ceci', nombre: 'Ceci: The Bridge', permiso: 'freeBusyReader', persona: 'ceci' },
  ]
  base.van = ['martina', 'beto', 'ceci'].map((persona) => ({ evento: 'p1', persona }))
  cuenta.lista = base.calendarios.map((c) => ({ id: c.google_id, summary: c.nombre, accessRole: c.permiso }))
  assert.deepEqual(await correr(), {
    estado: 200,
    cuerpo: { calendarios: 3, activa: true, crear: 1, actualizar: 0, borrar: 0, ocupados: 0, errores: 0 },
  })
  assert.deepEqual(cuenta.pedidos, [
    'POST /token',
    'GET /calendar/v3/users/me/calendarList',
    'GET /calendar/v3/calendars/cal-martina/events',
    'GET /calendar/v3/calendars/cal-beto/events',
    'POST /calendar/v3/calendars/cal-martina/events',
  ])
})

test('Sin el permiso de Google, o si Google ya no lo acepta, no escribe nada (ni el estado)', async () => {
  preparar(true)
  base.acceso = null
  assert.deepEqual(await correr(), { estado: 500, cuerpo: { error: 'Hay que volver a conectar Google Calendar.' } })
  assert.deepEqual([cuenta.pedidos, base.escrituras], [[], []])
  preparar(true)
  cuenta.aceptaPermiso = false
  assert.deepEqual(await correr(), { estado: 500, cuerpo: { error: 'Hay que volver a conectar Google Calendar.' } })
  assert.deepEqual([cuenta.pedidos, base.escrituras], [['POST /token'], []])
})

test('Si la lista de calendarios no se puede leer, la tabla queda como estaba y el error queda anotado', async () => {
  preparar(false)
  cuenta.listaFalla = true
  const { estado, cuerpo } = await correr()
  assert.equal(estado, 500)
  assert.deepEqual(cuerpo, { error: 'Algunas operaciones fallaron.', calendarios: 0, activa: false, crear: 0, actualizar: 0, borrar: 0, ocupados: 0, errores: 1 })
  assert.deepEqual(sqlDe(base.escrituras), ['update public.sincronizacion set'])
  assert.deepEqual(base.escrituras[0].valores, [1])
})

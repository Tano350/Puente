// Pruebas de una vuelta completa de index.ts con Deno, la base y los servicios de push de mentira. Los dispositivos
// son navegadores de mentira con sus propias llaves: descifran lo que les llega. Corren con:
// node --test "supabase/functions/avisos/*.test.ts"
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import type { Fila } from './mensajes.ts'
import { descifrar, nuevoNavegador, type Navegador } from './navegador.ts'
import { aBase64url } from './webpush.ts'

type Escritura = { sql: string; valores: unknown[] }

// La base de mentira: entrega la tanda una vez, responde las lecturas y anota cada escritura
const base = {
  tanda: [] as Fila[],
  dispositivos: [] as { endpoint: string; persona: string; p256dh: string; auth: string }[],
  escrituras: [] as Escritura[],
  lecturas: [] as string[],
}

function responder(sql: string, valores: unknown[]): unknown[] {
  base.lecturas.push(sql.split(' ').slice(0, 2).join(' '))
  if (sql.startsWith('with reclamados')) {
    const tanda = base.tanda
    base.tanda = []
    return tanda
  }
  if (sql.startsWith('select extract(epoch')) return [{ falta: null }]
  if (sql.startsWith('select endpoint')) {
    const personas = (valores[0] as { ayudante: string[] }).ayudante
    return base.dispositivos.filter((d) => personas.includes(d.persona))
  }
  assert.ok(!sql.startsWith('select'), `lectura inesperada: ${sql}`)
  base.escrituras.push({ sql, valores })
  return []
}

function postgresDeMentira() {
  const sql = (partes: unknown, ...valores: unknown[]): unknown =>
    Array.isArray(partes) && 'raw' in partes ? Promise.resolve(responder(partes.join('?').replace(/\s+/g, ' ').trim(), valores)) : { ayudante: partes }
  return Object.assign(sql, { end: async () => {} })
}

// Los servicios de push de mentira: cada dirección responde lo que diga la prueba y se anota lo que llegó
const servicio = {
  respuestas: new Map<string, number>(),
  llegadas: [] as { url: string; headers: Record<string, string>; body: Uint8Array }[],
}
async function pushDeMentira(url: string | URL | Request, opciones: RequestInit = {}): Promise<Response> {
  const direccion = String(url)
  servicio.llegadas.push({ url: direccion, headers: opciones.headers as Record<string, string>, body: opciones.body as Uint8Array })
  const estado = servicio.respuestas.get(direccion) ?? 201
  return new Response(estado === 201 ? null : 'push subscription has unsubscribed or expired', { status: estado })
}

// Llaves VAPID generadas para la prueba (nunca las de .env.local)
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const entorno: Record<string, string | undefined> = {
  AVISOS_CLAVE: 'clave-de-prueba',
  VAPID_PUBLIC_KEY: aBase64url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))),
  VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', par.privateKey)).d,
  VAPID_SUBJECT: 'https://puente.example.com',
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
  fetch: pushDeMentira,
  Deno: { serve: (h: typeof manejar) => (manejar = h), env: { get: (nombre: string) => entorno[nombre] } },
})
console.log = () => {}
console.error = () => {}
await import('./index.ts')

async function correr(autorizacion: string | null = 'Bearer clave-de-prueba') {
  base.escrituras = []
  base.lecturas = []
  servicio.llegadas = []
  const headers = autorizacion ? { Authorization: autorizacion } : undefined
  const respuesta = await manejar(new Request('https://ref.supabase.co/functions/v1/avisos', { method: 'POST', headers }))
  return { estado: respuesta.status, cuerpo: await respuesta.json() }
}

const ahora = Date.now()
function pago(cambios: Partial<Fila> = {}): Fila {
  return {
    id: 'aviso-1',
    tipo: 'pago',
    persona: 'josefa',
    creado_en: new Date(ahora - 15_000),
    datos: null,
    idioma: 'es',
    sacada: false,
    quiere: true,
    evento_id: null,
    titulo: null,
    lugar: null,
    direccion: null,
    inicio: null,
    fin: null,
    modo: null,
    cupos: null,
    cancelado_en: null,
    estado: null,
    van: null,
    contacto_id: null,
    contacto_nombre: null,
    organizacion: null,
    responsable: null,
    asigna: null,
    pago_id: 'p1',
    monto: 2500,
    borrado_en: null,
    paga: 'Diego Soto',
    ...cambios,
  }
}

let celular: Navegador
let computador: Navegador
let deOtra: Navegador
async function preparar(tanda: Fila[]) {
  celular = await nuevoNavegador('https://fcm.googleapis.com/fcm/send/celular-de-josefa')
  computador = await nuevoNavegador('https://updates.push.services.mozilla.com/wpush/v2/computador-de-josefa')
  deOtra = await nuevoNavegador('https://web.push.apple.com/celular-de-martina')
  base.tanda = tanda
  base.dispositivos = [
    { ...celular.suscripcion, persona: 'josefa' },
    { ...computador.suscripcion, persona: 'josefa' },
    { ...deOtra.suscripcion, persona: 'martina' },
  ]
  servicio.respuestas = new Map()
}
const sqlDe = (escrituras: Escritura[]) => escrituras.map((e) => e.sql.split(' ').slice(0, 3).join(' '))

test('Sin la clave correcta en "Authorization: Bearer" no hace nada', async () => {
  for (const autorizacion of [null, 'Bearer otra-clave', 'clave-de-prueba', 'Basic clave-de-prueba']) {
    await preparar([pago()])
    assert.deepEqual(await correr(autorizacion), { estado: 401, cuerpo: { error: 'No autorizado.' } })
    assert.deepEqual([base.lecturas, servicio.llegadas], [[], []])
  }
})

test('Manda el aviso cifrado a cada dispositivo de la persona; un dispositivo que ya no existe se borra', async () => {
  await preparar([pago()])
  servicio.respuestas.set(computador.suscripcion.endpoint, 410)
  assert.deepEqual(await correr(), { estado: 200, cuerpo: { enviados: 1, descartados: 0, fallidos: 0, dispositivosBorrados: 1 } })
  assert.deepEqual(
    servicio.llegadas.map((l) => l.url),
    [celular.suscripcion.endpoint, computador.suscripcion.endpoint],
  )
  const [alCelular] = servicio.llegadas
  assert.deepEqual(JSON.parse(await descifrar(alCelular.body, celular)), {
    titulo: 'Diego te pagó US$ 25,00',
    cuerpo: 'Tus saldos ya están al día.',
    url: '/gastos',
    etiqueta: 'pago-p1',
  })
  assert.equal(alCelular.headers.TTL, '86400')
  assert.equal(alCelular.headers.Urgency, 'normal')
  assert.match(alCelular.headers.Authorization, /^vapid t=.+, k=.+$/)
  assert.deepEqual(sqlDe(base.escrituras), ['delete from public.suscripciones', 'update public.avisos set'])
  assert.deepEqual(base.escrituras[0].valores, [computador.suscripcion.endpoint])
  assert.match(base.escrituras[1].sql, /set enviado_en = now\(\), ultimo_error = \?/)
  assert.deepEqual(base.escrituras[1].valores, [null, 'aviso-1'])
})

test('El recordatorio sale urgente y en el idioma de quien lo recibe', async () => {
  const inicio = new Date(ahora + 50 * 60_000)
  await preparar([
    pago({
      tipo: 'recordatorio',
      idioma: 'en',
      pago_id: null,
      monto: null,
      paga: null,
      evento_id: 'e1',
      titulo: 'Visita de prueba',
      lugar: null,
      direccion: '1 Example Way',
      inicio,
      fin: new Date(inicio.getTime() + 3600_000),
      estado: 'va',
    }),
  ])
  base.dispositivos = base.dispositivos.slice(0, 1)
  assert.deepEqual(await correr(), { estado: 200, cuerpo: { enviados: 1, descartados: 0, fallidos: 0, dispositivosBorrados: 0 } })
  const [llegada] = servicio.llegadas
  const aviso = JSON.parse(await descifrar(llegada.body, celular))
  assert.deepEqual({ ...aviso, titulo: undefined }, { titulo: undefined, cuerpo: '1 Example Way', url: '/agenda/e1', etiqueta: 'evento-e1' })
  assert.match(aviso.titulo, /^At \d\d:\d\d: Visita de prueba$/)
  assert.equal(llegada.headers.Urgency, 'high')
  assert.ok(Number(llegada.headers.TTL) <= 3600)
})

test('Lo que ya no tiene sentido se descarta sin mandar nada', async () => {
  await preparar([pago({ borrado_en: new Date() }), pago({ id: 'aviso-2', persona: 'nadie' })])
  assert.deepEqual(await correr(), { estado: 200, cuerpo: { enviados: 0, descartados: 2, fallidos: 0, dispositivosBorrados: 0 } })
  assert.deepEqual(servicio.llegadas, [])
  assert.deepEqual(
    base.escrituras.map((e) => e.valores),
    [
      ['Se deshizo el pago.', 'aviso-1'],
      ['Sin dispositivos.', 'aviso-2'],
    ],
  )
})

test('Si el servicio de push falla, el error queda anotado y el aviso sigue pendiente para el próximo intento', async () => {
  await preparar([pago()])
  servicio.respuestas.set(celular.suscripcion.endpoint, 503)
  servicio.respuestas.set(computador.suscripcion.endpoint, 429)
  const { estado, cuerpo } = await correr()
  assert.equal(estado, 500)
  assert.deepEqual(cuerpo, { error: 'Algunos avisos no salieron.', enviados: 0, descartados: 0, fallidos: 1, dispositivosBorrados: 0 })
  assert.deepEqual(sqlDe(base.escrituras), ['update public.avisos set'])
  assert.match(base.escrituras[0].sql, /set ultimo_error = \?/)
  assert.match(String(base.escrituras[0].valores[0]), /^fcm\.googleapis\.com respondió 503.*\| updates\.push\.services\.mozilla\.com respondió 429/)
})

test('Si llegó a un dispositivo y falló en otro, cuenta como enviado (no se repite) y anota el error', async () => {
  await preparar([pago()])
  servicio.respuestas.set(computador.suscripcion.endpoint, 500)
  assert.deepEqual(await correr(), { estado: 200, cuerpo: { enviados: 1, descartados: 0, fallidos: 0, dispositivosBorrados: 0 } })
  assert.match(String(base.escrituras[0].valores[0]), /mozilla\.com respondió 500/)
})

test('Sin las llaves VAPID (o si no son pareja) no toca la base y dice qué falta', async () => {
  await preparar([pago()])
  const privada = entorno.VAPID_PRIVATE_KEY
  entorno.VAPID_PRIVATE_KEY = undefined
  assert.deepEqual(await correr(), { estado: 500, cuerpo: { error: 'Falta VAPID_PRIVATE_KEY.' } })
  entorno.VAPID_PRIVATE_KEY = aBase64url(crypto.getRandomValues(new Uint8Array(32)))
  assert.deepEqual(await correr(), { estado: 500, cuerpo: { error: 'VAPID_PUBLIC_KEY no es la pareja de VAPID_PRIVATE_KEY.' } })
  entorno.VAPID_PRIVATE_KEY = privada
  assert.deepEqual([base.lecturas, servicio.llegadas], [[], []])
})

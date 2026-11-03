// Pruebas de la entrada a Google y del cliente del calendario, con una llave hecha aquí y un fetch de mentira.
// Corren con: node --test supabase/functions/calendario/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DESDE, HASTA } from './cruce.ts'
import { calendario, ErrorGoogle, firmarJwt, pedirToken, type CuerpoGoogle, type Pedir } from './google.ts'

const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`
const cuenta = { client_email: 'puente@viaje.iam.gserviceaccount.com', private_key: pem }

const desdeBase64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const leer = (s: string) => JSON.parse(new TextDecoder().decode(desdeBase64url(s)))

async function firmaValida(jwt: string): Promise<boolean> {
  const [cabecera, datos, firma] = jwt.split('.')
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, desdeBase64url(firma), new TextEncoder().encode(`${cabecera}.${datos}`))
}

// Un fetch de mentira que anota cada llamada y responde en orden
type Llamada = { url: URL; metodo: string; headers: Record<string, string>; cuerpo: unknown }
function falso(respuestas: [number, unknown][]) {
  const llamadas: Llamada[] = []
  const pedir: Pedir = async (url, opciones = {}) => {
    const cuerpo = typeof opciones.body === 'string' ? JSON.parse(opciones.body) : opciones.body
    llamadas.push({ url: new URL(url), metodo: opciones.method ?? 'GET', headers: (opciones.headers ?? {}) as Record<string, string>, cuerpo })
    const [estado, datos] = respuestas.shift() ?? [500, null]
    return new Response(datos === null ? null : JSON.stringify(datos), { status: estado })
  }
  return { pedir, llamadas }
}

const cuerpo: CuerpoGoogle = {
  summary: 'Visita a Google',
  description: 'https://puente-2027.vercel.app/agenda/p1',
  start: { dateTime: '2027-01-12T18:00:00Z', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2027-01-12T19:30:00Z', timeZone: 'America/Los_Angeles' },
  status: 'confirmed',
  extendedProperties: { private: { puente: 'p1' } },
}

test('El JWT va firmado con la llave de la cuenta (RS256) y pide el calendario por una hora', async () => {
  const jwt = await firmarJwt(cuenta, 1_800_000_000_000)
  const [cabecera, datos] = jwt.split('.')
  assert.ok(await firmaValida(jwt))
  assert.deepEqual(leer(cabecera), { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(leer(datos), {
    iss: 'puente@viaje.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1_800_000_000,
    exp: 1_800_003_600,
  })
  // Con otros datos, la misma firma ya no vale
  const otro = `${cabecera}.${datos.slice(0, -2)}xx.${jwt.split('.')[2]}`
  assert.equal(await firmaValida(otro), false)
})

test('La llave sirve aunque los saltos de línea se hayan pegado escritos como \\n', async () => {
  assert.ok(await firmaValida(await firmarJwt({ ...cuenta, private_key: pem.replace(/\n/g, '\\n') })))
})

test('pedirToken cambia el JWT firmado por un token de acceso', async () => {
  const { pedir, llamadas } = falso([[200, { access_token: 'ya29.de-prueba', expires_in: 3599, token_type: 'Bearer' }]])
  assert.equal(await pedirToken(cuenta, pedir), 'ya29.de-prueba')
  assert.equal(llamadas.length, 1)
  const [{ url, metodo, headers, cuerpo: enviado }] = llamadas
  assert.equal(url.href, 'https://oauth2.googleapis.com/token')
  assert.equal(metodo, 'POST')
  assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded')
  assert.ok(enviado instanceof URLSearchParams)
  assert.equal(enviado.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  assert.ok(await firmaValida(enviado.get('assertion') ?? ''))
})

test('Si Google no da acceso, el error es corto y no lleva la llave', async () => {
  const { pedir } = falso([[400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }]])
  await assert.rejects(pedirToken(cuenta, pedir), (error: unknown) => {
    assert.ok(error instanceof ErrorGoogle)
    assert.equal(error.estado, 400)
    assert.equal(error.message, 'Google no dio acceso al calendario (400: Invalid JWT Signature.)')
    return true
  })
})

test('listar trae toda la ventana, con los borrados y cada repetición, página por página', async () => {
  const { pedir, llamadas } = falso([
    [200, { items: [{ id: 'a', status: 'confirmed' }], nextPageToken: 'pagina2' }],
    [200, { items: [{ id: 'b', status: 'cancelled' }] }],
  ])
  const eventos = await calendario('ya29.de-prueba', 'viaje@group.calendar.google.com', pedir).listar(DESDE, HASTA)
  assert.deepEqual(
    eventos.map((e) => e.id),
    ['a', 'b'],
  )
  assert.equal(llamadas.length, 2)
  for (const [i, { url, metodo, headers }] of llamadas.entries()) {
    assert.equal(metodo, 'GET')
    assert.equal(`${url.origin}${url.pathname}`, 'https://www.googleapis.com/calendar/v3/calendars/viaje%40group.calendar.google.com/events')
    assert.equal(headers.Authorization, 'Bearer ya29.de-prueba')
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      singleEvents: 'true',
      showDeleted: 'true',
      timeMin: '2026-12-01T00:00:00Z',
      timeMax: '2027-04-01T00:00:00Z',
      maxResults: '2500',
      ...(i === 1 ? { pageToken: 'pagina2' } : {}),
    })
  }
})

test('Una lista ilegible no se toma por vacía', async () => {
  const { pedir } = falso([[200, null]])
  await assert.rejects(calendario('t', 'c', pedir).listar(DESDE, HASTA), { message: 'Google respondió sin la lista de eventos' })
})

test('Todo lo que se escribe va sin avisarle a nadie (sendUpdates=none)', async () => {
  const { pedir, llamadas } = falso([[200, { id: 'g1', status: 'confirmed' }], [200, { id: 'g1', status: 'confirmed' }], [204, null]])
  const google = calendario('ya29.de-prueba', 'viaje@group.calendar.google.com', pedir)
  assert.equal((await google.crear(cuerpo)).id, 'g1')
  assert.equal((await google.guardar('g1', cuerpo)).id, 'g1')
  await google.borrar('g1')
  assert.deepEqual(
    llamadas.map((l) => `${l.metodo} ${l.url.pathname.split('/events')[1]}`),
    ['POST ', 'PUT /g1', 'DELETE /g1'],
  )
  for (const l of llamadas) {
    assert.deepEqual(Object.fromEntries(l.url.searchParams), { sendUpdates: 'none' })
    assert.equal(l.headers.Authorization, 'Bearer ya29.de-prueba')
  }
  assert.deepEqual(llamadas[0].cuerpo, cuerpo)
  assert.deepEqual(llamadas[1].cuerpo, cuerpo)
  assert.equal(llamadas[0].headers['Content-Type'], 'application/json')
})

test('guardar lo crea de nuevo si Google ya no lo tiene o no lo revive', async () => {
  const perdido: [number, unknown][] = [
    [404, { error: { code: 404, message: 'Not Found' } }],
    [410, { error: { code: 410, message: 'Resource has been deleted' } }],
    [200, { id: 'g1', status: 'cancelled' }],
  ]
  for (const respuesta of perdido) {
    const { pedir, llamadas } = falso([respuesta, [200, { id: 'g2', status: 'confirmed' }]])
    assert.equal((await calendario('t', 'c', pedir).guardar('g1', cuerpo)).id, 'g2')
    assert.deepEqual(
      llamadas.map((l) => l.metodo),
      ['PUT', 'POST'],
    )
    assert.deepEqual(llamadas[1].cuerpo, cuerpo)
  }
})

test('borrar no falla si ya no estaba, pero sí ante otros errores', async () => {
  for (const estado of [204, 404, 410]) await calendario('t', 'c', falso([[estado, null]]).pedir).borrar('g1')
  const { pedir } = falso([[500, { error: { code: 500, message: 'Backend Error' } }]])
  await assert.rejects(calendario('t', 'c', pedir).borrar('g1'), { estado: 500, message: 'Google respondió 500 al borrar un evento: Backend Error' })
})

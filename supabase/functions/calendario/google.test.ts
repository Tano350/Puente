// Pruebas de la entrada a Google y del cliente de los calendarios, con un fetch de mentira. Corren con:
// node --test "supabase/functions/calendario/*.test.ts"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DESDE, HASTA } from './cruce.ts'
import { ErrorGoogle, google, pedirToken, RECONECTAR, type CuerpoGoogle, type Pedir } from './google.ts'

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

const acceso = { client_id: 'cliente.apps.googleusercontent.com', client_secret: 'secreto-del-cliente', refresh_token: '1//permiso-de-vicente' }
const CALENDARIO = 'c_abc123@group.calendar.google.com'
const EVENTOS = 'https://www.googleapis.com/calendar/v3/calendars/c_abc123%40group.calendar.google.com/events'
const cuerpo: CuerpoGoogle = {
  summary: 'Visita a Google',
  description: 'https://puente-2027.vercel.app/agenda/p1',
  start: { dateTime: '2027-01-12T18:00:00Z', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2027-01-12T19:30:00Z', timeZone: 'America/Los_Angeles' },
  status: 'confirmed',
  extendedProperties: { private: { puente: 'p1' } },
}

test('pedirToken cambia el permiso guardado por un token de acceso', async () => {
  const { pedir, llamadas } = falso([[200, { access_token: 'ya29.de-prueba', expires_in: 3599, token_type: 'Bearer' }]])
  assert.equal(await pedirToken(acceso, pedir), 'ya29.de-prueba')
  assert.equal(llamadas.length, 1)
  const [{ url, metodo, headers, cuerpo: enviado }] = llamadas
  assert.equal(url.href, 'https://oauth2.googleapis.com/token')
  assert.equal(metodo, 'POST')
  assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded')
  assert.ok(enviado instanceof URLSearchParams)
  assert.deepEqual(Object.fromEntries(enviado), {
    grant_type: 'refresh_token',
    client_id: 'cliente.apps.googleusercontent.com',
    client_secret: 'secreto-del-cliente',
    refresh_token: '1//permiso-de-vicente',
  })
})

test('Si Google ya no acepta el permiso, hay que volver a conectar (sin mostrar nada secreto)', async () => {
  const { pedir } = falso([[400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }]])
  await assert.rejects(pedirToken(acceso, pedir), (error: unknown) => {
    assert.ok(error instanceof ErrorGoogle)
    assert.equal(error.message, RECONECTAR)
    assert.equal(RECONECTAR, 'Hay que volver a conectar Google Calendar.')
    return true
  })
  // Otro problema (por ejemplo, el secreto del cliente está mal) dice lo que respondió Google
  const otro = falso([[401, { error: 'invalid_client', error_description: 'Unauthorized' }]])
  await assert.rejects(pedirToken(acceso, otro.pedir), (error: unknown) => {
    assert.ok(error instanceof ErrorGoogle)
    assert.equal(error.message, 'Google no dio acceso (401: Unauthorized)')
    assert.ok(!error.message.includes('secreto-del-cliente') && !error.message.includes('permiso-de-vicente'))
    return true
  })
})

test('calendarios lista todos los calendarios de quien administra, también los escondidos, página por página', async () => {
  const { pedir, llamadas } = falso([
    [200, { items: [{ id: 'a', summary: 'The Bridge: Vicente' }], nextPageToken: 'pagina2' }],
    [200, { items: [{ id: 'b', summary: 'The Bridge: Coti' }] }],
  ])
  const lista = await google('ya29.de-prueba', pedir).calendarios()
  assert.deepEqual(
    lista.map((c) => c.id),
    ['a', 'b'],
  )
  for (const [i, { url, metodo, headers }] of llamadas.entries()) {
    assert.equal(metodo, 'GET')
    assert.equal(`${url.origin}${url.pathname}`, 'https://www.googleapis.com/calendar/v3/users/me/calendarList')
    assert.equal(headers.Authorization, 'Bearer ya29.de-prueba')
    assert.deepEqual(Object.fromEntries(url.searchParams), { maxResults: '250', showHidden: 'true', ...(i === 1 ? { pageToken: 'pagina2' } : {}) })
  }
})

test('listar trae la ventana de un calendario, cada repetición por separado, página por página', async () => {
  const { pedir, llamadas } = falso([
    [200, { items: [{ id: 'x1' }], nextPageToken: 'pagina2' }],
    [200, { items: [{ id: 'x2' }] }],
  ])
  const eventos = await google('ya29.de-prueba', pedir).listar(CALENDARIO, DESDE, HASTA)
  assert.deepEqual(
    eventos.map((e) => e.id),
    ['x1', 'x2'],
  )
  for (const [i, { url, metodo, headers }] of llamadas.entries()) {
    assert.equal(metodo, 'GET')
    assert.equal(`${url.origin}${url.pathname}`, EVENTOS)
    assert.equal(headers.Authorization, 'Bearer ya29.de-prueba')
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      singleEvents: 'true',
      timeMin: '2026-12-01T00:00:00Z',
      timeMax: '2027-04-01T00:00:00Z',
      maxResults: '2500',
      ...(i === 1 ? { pageToken: 'pagina2' } : {}),
    })
  }
})

test('Una lista ilegible no se toma por vacía, y un calendario sin permiso da error', async () => {
  await assert.rejects(google('t', falso([[200, null]]).pedir).listar(CALENDARIO, DESDE, HASTA), { estado: 502 })
  await assert.rejects(google('t', falso([[404, { error: { code: 404, message: 'Not Found' } }]]).pedir).listar(CALENDARIO, DESDE, HASTA), {
    estado: 404,
    message: 'Google respondió 404 al leer un calendario: Not Found',
  })
})

test('Todo lo que se escribe va al calendario de esa persona, sin avisarle a nadie (sendUpdates=none)', async () => {
  const { pedir, llamadas } = falso([[200, { id: 'c1' }], [200, { id: 'c1' }], [204, null]])
  const g = google('ya29.de-prueba', pedir)
  await g.crear(CALENDARIO, cuerpo)
  await g.guardar(CALENDARIO, 'c1', cuerpo)
  await g.borrar(CALENDARIO, 'c1')
  assert.deepEqual(
    llamadas.map((l) => `${l.metodo} ${l.url.origin}${l.url.pathname}`),
    [`POST ${EVENTOS}`, `PUT ${EVENTOS}/c1`, `DELETE ${EVENTOS}/c1`],
  )
  for (const l of llamadas) {
    assert.deepEqual(Object.fromEntries(l.url.searchParams), { sendUpdates: 'none' })
    assert.equal(l.headers.Authorization, 'Bearer ya29.de-prueba')
  }
  assert.deepEqual(llamadas[0].cuerpo, cuerpo)
  assert.deepEqual(llamadas[1].cuerpo, cuerpo)
  assert.equal(llamadas[0].headers['Content-Type'], 'application/json')
})

test('guardar la crea de nuevo si justo la borraron', async () => {
  for (const estado of [404, 410]) {
    const { pedir, llamadas } = falso([[estado, { error: { code: estado, message: 'Gone' } }], [200, { id: 'c2' }]])
    await google('t', pedir).guardar(CALENDARIO, 'c1', cuerpo)
    assert.deepEqual(
      llamadas.map((l) => l.metodo),
      ['PUT', 'POST'],
    )
    assert.deepEqual(llamadas[1].cuerpo, cuerpo)
  }
})

test('Sin permiso para cambiar eventos, escribir da un error con el estado de Google', async () => {
  const sinPermiso: [number, unknown][] = [[403, { error: { code: 403, message: 'Forbidden' } }]]
  await assert.rejects(google('t', falso(structuredClone(sinPermiso)).pedir).crear(CALENDARIO, cuerpo), { estado: 403 })
  await assert.rejects(google('t', falso(structuredClone(sinPermiso)).pedir).guardar(CALENDARIO, 'c1', cuerpo), { estado: 403 })
  await assert.rejects(google('t', falso(structuredClone(sinPermiso)).pedir).borrar(CALENDARIO, 'c1'), {
    estado: 403,
    message: 'Google respondió 403 al borrar un evento: Forbidden',
  })
})

test('borrar no falla si ya no estaba', async () => {
  for (const estado of [204, 404, 410]) await google('t', falso([[estado, null]]).pedir).borrar(CALENDARIO, 'c1')
})

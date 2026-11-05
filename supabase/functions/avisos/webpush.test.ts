// Pruebas del cifrado y la firma de Web Push. Corren con:
// node --test "supabase/functions/avisos/*.test.ts"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { descifrar, llaveEcdh, nuevoNavegador } from './navegador.ts'
import { aBase64url, cifrar, deBase64url, firmaVapid, llavesVapid, MAXIMO_CONTENIDO, pedidoPush } from './webpush.ts'

// RFC 8291, apéndice A: todos los valores del ejemplo
const RFC = {
  contenido: 'When I grow up, I want to be a watermelon',
  asPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  mensaje:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

test('Cifra exacto el ejemplo del apéndice A del RFC 8291', async () => {
  const asPublica = deBase64url(RFC.asPublica)
  const efimera = { privada: await llaveEcdh(deBase64url(RFC.asPrivada), asPublica), publica: asPublica }
  const cuerpo = await cifrar(new TextEncoder().encode(RFC.contenido), { p256dh: RFC.uaPublica, auth: RFC.auth }, { sal: deBase64url(RFC.sal), efimera })
  assert.equal(aBase64url(cuerpo), RFC.mensaje)
})

test('El navegador del ejemplo del RFC descifra el mensaje', async () => {
  const uaPublica = deBase64url(RFC.uaPublica)
  const navegador = {
    suscripcion: { endpoint: 'https://push.example.com/x', p256dh: RFC.uaPublica, auth: RFC.auth },
    privada: await llaveEcdh(deBase64url(RFC.uaPrivada), uaPublica),
  }
  assert.equal(await descifrar(deBase64url(RFC.mensaje), navegador), RFC.contenido)
})

test('Con llaves nuevas cada vez: dos mensajes iguales salen distintos y los dos se descifran', async () => {
  const navegador = await nuevoNavegador('https://push.example.com/y')
  const contenido = JSON.stringify({ titulo: 'Tienes cupo: Visita de prueba', cuerpo: 'Ñandú, café y acentos.' })
  const uno = await cifrar(new TextEncoder().encode(contenido), navegador.suscripcion)
  const otro = await cifrar(new TextEncoder().encode(contenido), navegador.suscripcion)
  assert.notEqual(aBase64url(uno), aBase64url(otro))
  assert.equal(await descifrar(uno, navegador), contenido)
  assert.equal(await descifrar(otro, navegador), contenido)
})

test('No cifra algo que el servicio de push rechazaría por tamaño, ni con llaves mal formadas', async () => {
  const navegador = await nuevoNavegador('https://push.example.com/z')
  await cifrar(new Uint8Array(MAXIMO_CONTENIDO), navegador.suscripcion)
  await assert.rejects(cifrar(new Uint8Array(MAXIMO_CONTENIDO + 1), navegador.suscripcion), /máximo/)
  await assert.rejects(cifrar(new Uint8Array(1), { ...navegador.suscripcion, p256dh: 'AAAA' }), /p256dh/)
  await assert.rejects(cifrar(new Uint8Array(1), { ...navegador.suscripcion, auth: 'AAAA' }), /auth/)
})

async function vapidDePrueba() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publica = aBase64url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)))
  const { d } = await crypto.subtle.exportKey('jwk', par.privateKey)
  return { publica, privada: d!, verificadora: par.publicKey }
}

test('El JWT de VAPID va firmado con ES256 y se verifica con la llave pública', async () => {
  const llaves = await vapidDePrueba()
  const vapid = await llavesVapid(llaves.publica, llaves.privada, 'https://puente.example.com')
  const ahora = Date.UTC(2027, 0, 12, 18)
  const jwt = await firmaVapid(vapid, 'https://fcm.googleapis.com', ahora)
  const [cabeza, reclamos, firma] = jwt.split('.')
  const leer = (parte: string) => JSON.parse(new TextDecoder().decode(deBase64url(parte)))
  assert.deepEqual(leer(cabeza), { typ: 'JWT', alg: 'ES256' })
  assert.deepEqual(leer(reclamos), { aud: 'https://fcm.googleapis.com', exp: ahora / 1000 + 12 * 3600, sub: 'https://puente.example.com' })
  assert.equal(deBase64url(firma).length, 64)
  const valida = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    llaves.verificadora,
    deBase64url(firma),
    new TextEncoder().encode(`${cabeza}.${reclamos}`),
  )
  assert.ok(valida, 'la firma no se verifica con la llave pública')
})

test('Las llaves VAPID tienen que ser pareja y el sujeto, una dirección https o un correo', async () => {
  const una = await vapidDePrueba()
  const otra = await vapidDePrueba()
  await assert.rejects(llavesVapid(una.publica, otra.privada, 'https://puente.example.com'), /pareja/)
  await assert.rejects(llavesVapid(una.publica, una.privada, 'puente.example.com'), /VAPID_SUBJECT/)
  await assert.rejects(llavesVapid(una.publica, 'AAAA', 'https://puente.example.com'), /32 bytes/)
  await assert.rejects(llavesVapid('AAAA', una.privada, 'https://puente.example.com'), /VAPID_PUBLIC_KEY/)
})

test('El pedido lleva VAPID, TTL, urgencia y el cuerpo cifrado que el navegador lee', async () => {
  const llaves = await vapidDePrueba()
  const vapid = await llavesVapid(llaves.publica, llaves.privada, 'https://puente.example.com')
  const navegador = await nuevoNavegador('https://web.push.apple.com/QGuQyavXutnMnDjGq3Q')
  const { url, init } = await pedidoPush(navegador.suscripcion, '{"titulo":"Hola"}', vapid, { ttl: 3600, urgencia: 'high' })
  assert.equal(url, 'https://web.push.apple.com/QGuQyavXutnMnDjGq3Q')
  assert.equal(init.method, 'POST')
  assert.match(init.headers.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${llaves.publica}$`))
  const reclamos = JSON.parse(new TextDecoder().decode(deBase64url(init.headers.Authorization.split('.')[1])))
  assert.equal(reclamos.aud, 'https://web.push.apple.com')
  assert.deepEqual(
    { ...init.headers, Authorization: undefined },
    { Authorization: undefined, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high' },
  )
  assert.equal(await descifrar(init.body, navegador), '{"titulo":"Hola"}')
  await assert.rejects(pedidoPush({ ...navegador.suscripcion, endpoint: 'http://push.example.com/x' }, '{}', vapid, { ttl: 60, urgencia: 'normal' }), /https/)
})

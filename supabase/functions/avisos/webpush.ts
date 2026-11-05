// Web Push sin librerías, solo con WebCrypto: el contenido va cifrado con aes128gcm (RFC 8291) y el pedido va firmado
// con VAPID, un JWT ES256 (RFC 8292). Corre igual en Deno (la función) y en Node (las pruebas).

const texto = new TextEncoder()

// Tamaño de registro: el contenido va en un solo registro. Los servicios de push aceptan hasta 4096 bytes de cuerpo:
// 86 de encabezado (sal, tamaño, largo de la llave y la llave), 16 de la etiqueta de AES-GCM y 1 del delimitador.
const TAMANO_REGISTRO = 4096
export const MAXIMO_CONTENIDO = 4096 - 86 - 16 - 1

export type Suscripcion = { endpoint: string; p256dh: string; auth: string }
export type Urgencia = 'very-low' | 'low' | 'normal' | 'high'
// La llave efímera del servidor para un mensaje; las pruebas la inyectan para reproducir el ejemplo del RFC
export type Efimera = { privada: CryptoKey; publica: Uint8Array }
export type Vapid = { publica: string; privada: CryptoKey; sujeto: string }

export function aBase64url(bytes: Uint8Array): string {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function deBase64url(t: string): Uint8Array<ArrayBuffer> {
  const limpio = t.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const binario = atob(limpio + '='.repeat((4 - (limpio.length % 4)) % 4))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

function unir(...partes: ArrayLike<number>[]): Uint8Array<ArrayBuffer> {
  const total = new Uint8Array(partes.reduce((suma, p) => suma + p.length, 0))
  let i = 0
  for (const p of partes) {
    total.set(p, i)
    i += p.length
  }
  return total
}

async function hmac(llave: Uint8Array<ArrayBuffer>, datos: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos))
}

// Un punto P-256 sin comprimir: 0x04, x e y (65 bytes)
function punto(llave: string, nombre: string): Uint8Array<ArrayBuffer> {
  const bytes = deBase64url(llave)
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error(`${nombre} no es una llave P-256 sin comprimir.`)
  return bytes
}

export async function nuevaEfimera(): Promise<Efimera> {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  return { privada: par.privateKey, publica: new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)) }
}

// RFC 8291: cifra el contenido para un navegador, con su llave pública (p256dh) y su secreto (auth)
export async function cifrar(
  contenido: Uint8Array,
  destino: Pick<Suscripcion, 'p256dh' | 'auth'>,
  opciones: { sal?: Uint8Array; efimera?: Efimera } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (contenido.length > MAXIMO_CONTENIDO) throw new Error(`El aviso pesa ${contenido.length} bytes; el máximo es ${MAXIMO_CONTENIDO}.`)
  const uaPublica = punto(destino.p256dh, 'p256dh')
  const secreto = deBase64url(destino.auth)
  if (secreto.length !== 16) throw new Error('auth no tiene 16 bytes.')
  const sal = unir(opciones.sal ?? crypto.getRandomValues(new Uint8Array(16)))
  if (sal.length !== 16) throw new Error('La sal no tiene 16 bytes.')
  const efimera = opciones.efimera ?? (await nuevaEfimera())

  const llaveUa = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: llaveUa }, efimera.privada, 256))
  // HKDF de un solo bloque: extraer con HMAC(sal, …) y expandir con HMAC(prk, info || 0x01)
  const prkLlave = await hmac(secreto, ecdh)
  const ikm = await hmac(prkLlave, unir(texto.encode('WebPush: info\0'), uaPublica, efimera.publica, [1]))
  const prk = await hmac(sal, ikm)
  const cek = (await hmac(prk, unir(texto.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16)
  const nonce = (await hmac(prk, unir(texto.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // Un solo registro, que también es el último: el delimitador es 0x02 y no lleva relleno
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, unir(contenido, [2])))
  const encabezado = new Uint8Array(21)
  encabezado.set(sal)
  new DataView(encabezado.buffer).setUint32(16, TAMANO_REGISTRO)
  encabezado[20] = efimera.publica.length
  return unir(encabezado, efimera.publica, cifrado)
}

// Las llaves VAPID: la pública en base64url (la misma que usa la app) y la privada (32 bytes en base64url).
// Revisa que sean un par: si no, todos los servicios de push rechazarían los avisos.
export async function llavesVapid(publica: string, privada: string, sujeto: string): Promise<Vapid> {
  const p = punto(publica, 'VAPID_PUBLIC_KEY')
  const d = deBase64url(privada)
  if (d.length !== 32) throw new Error('VAPID_PRIVATE_KEY no tiene 32 bytes.')
  if (!/^(https:\/\/|mailto:)/.test(sujeto)) throw new Error('VAPID_SUBJECT debe empezar con https:// o mailto:.')
  const jwk = { kty: 'EC', crv: 'P-256', d: aBase64url(d), x: aBase64url(p.slice(1, 33)), y: aBase64url(p.slice(33)) }
  const noSonPareja = new Error('VAPID_PUBLIC_KEY no es la pareja de VAPID_PRIVATE_KEY.')
  // Node ya rechaza al importar un par que no calza; Deno puede aceptarlo, y lo pilla la firma de prueba
  const llave = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']).catch(() => {
    throw noSonPareja
  })
  const verificadora = await crypto.subtle.importKey('raw', p, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  const prueba = texto.encode('puente')
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave, prueba)
  if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verificadora, firma, prueba))) throw noSonPareja
  return { publica: aBase64url(p), privada: llave, sujeto }
}

// RFC 8292: el JWT que prueba ante el servicio de push que el aviso viene de Puente. Vale 12 horas (el máximo es 24).
export async function firmaVapid(vapid: Vapid, audiencia: string, ahora = Date.now()): Promise<string> {
  const parte = (datos: unknown) => aBase64url(texto.encode(JSON.stringify(datos)))
  const sinFirmar = `${parte({ typ: 'JWT', alg: 'ES256' })}.${parte({ aud: audiencia, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: vapid.sujeto })}`
  // WebCrypto entrega la firma como r || s (64 bytes), que es justo lo que pide ES256
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.privada, texto.encode(sinFirmar)))
  return `${sinFirmar}.${aBase64url(firma)}`
}

// El pedido completo para un dispositivo: a dónde va, los encabezados y el cuerpo cifrado
export async function pedidoPush(
  destino: Suscripcion,
  contenido: string,
  vapid: Vapid,
  opciones: { ttl: number; urgencia: Urgencia; ahora?: number },
): Promise<{ url: string; init: { method: 'POST'; headers: Record<string, string>; body: Uint8Array<ArrayBuffer> } }> {
  const url = new URL(destino.endpoint)
  if (url.protocol !== 'https:') throw new Error('El dispositivo no tiene una dirección https.')
  const jwt = await firmaVapid(vapid, url.origin, opciones.ahora)
  return {
    url: url.href,
    init: {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${vapid.publica}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(Math.max(0, Math.round(opciones.ttl))),
        Urgency: opciones.urgencia,
      },
      body: await cifrar(texto.encode(contenido), destino),
    },
  }
}

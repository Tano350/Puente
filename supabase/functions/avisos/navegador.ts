// Solo para las pruebas: hace de navegador. Crea una suscripción con sus llaves y descifra lo que le llega
// (el lado que recibe de RFC 8291). La función no lo importa.
import { aBase64url, deBase64url, type Suscripcion } from './webpush.ts'

const texto = new TextEncoder()

async function hmac(llave: Uint8Array<ArrayBuffer>, datos: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos))
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

export type Navegador = { suscripcion: Suscripcion; privada: CryptoKey }

// Llave privada ECDH desde d, x e y en base64url (la forma en que el RFC da sus ejemplos)
export async function llaveEcdh(d: Uint8Array, publica: Uint8Array): Promise<CryptoKey> {
  const jwk = { kty: 'EC', crv: 'P-256', d: aBase64url(d), x: aBase64url(publica.slice(1, 33)), y: aBase64url(publica.slice(33)) }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
}

export async function nuevoNavegador(endpoint: string): Promise<Navegador> {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { suscripcion: { endpoint, p256dh: aBase64url(publica), auth: aBase64url(auth) }, privada: par.privateKey }
}

export async function descifrar(cuerpo: Uint8Array, navegador: Navegador): Promise<string> {
  const sal = unir(cuerpo.slice(0, 16))
  const tamano = new DataView(cuerpo.buffer, cuerpo.byteOffset).getUint32(16)
  const largo = cuerpo[20]
  const efimera = unir(cuerpo.slice(21, 21 + largo))
  const cifrado = unir(cuerpo.slice(21 + largo))
  if (cifrado.length > tamano) throw new Error('El registro es más grande que el tamaño anunciado.')
  const uaPublica = deBase64url(navegador.suscripcion.p256dh)
  const llaveAs = await crypto.subtle.importKey('raw', efimera, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: llaveAs }, navegador.privada, 256))
  const prkLlave = await hmac(deBase64url(navegador.suscripcion.auth), ecdh)
  const ikm = await hmac(prkLlave, unir(texto.encode('WebPush: info\0'), uaPublica, efimera, [1]))
  const prk = await hmac(sal, ikm)
  const cek = (await hmac(prk, unir(texto.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16)
  const nonce = (await hmac(prk, unir(texto.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12)
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cifrado))
  // Se quita el relleno: ceros al final, después del delimitador 0x02 del último registro
  let fin = claro.length - 1
  while (fin >= 0 && claro[fin] === 0) fin--
  if (claro[fin] !== 2) throw new Error('Falta el delimitador del último registro.')
  return new TextDecoder().decode(claro.slice(0, fin))
}

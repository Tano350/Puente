import { clear, createStore, del, entries, get, set, type UseStore } from 'idb-keyval'

// Fotos de boletas que ya subieron: cada una que se abre con señal queda guardada en el dispositivo (la imagen
// bajada, no la dirección firmada, que dura una hora) para verla también sin señal. Base propia, aparte de la de
// sinSenal.ts. Si el navegador no deja guardar, no pasa nada: se ve con señal como siempre.

export const MAX_FOTOS = 60
export const MAX_BYTES = 30 * 1024 * 1024

type Guardada = { foto: Blob; guardada: number }
export type Entrada = { ruta: string; bytes: number; guardada: number }

// Regla del tope: cuáles borrar (las más viejas primero) para quedar dentro del máximo de fotos y de bytes.
// La más nueva siempre se queda, aunque sola pase el tope de bytes.
export function aBorrar(lista: Entrada[], maxFotos = MAX_FOTOS, maxBytes = MAX_BYTES): string[] {
  const nuevasPrimero = [...lista].sort((a, b) => b.guardada - a.guardada)
  const borrar: string[] = []
  let fotos = 0
  let bytes = 0
  for (const e of nuevasPrimero) {
    if (fotos > 0 && (fotos + 1 > maxFotos || bytes + e.bytes > maxBytes)) borrar.push(e.ruta)
    else {
      fotos += 1
      bytes += e.bytes
    }
  }
  return borrar
}

let almacen: UseStore | undefined
function elAlmacen(): UseStore {
  almacen ??= createStore('puente-boletas', 'fotos')
  return almacen
}

export async function boletaEnDispositivo(ruta: string): Promise<Blob | null> {
  try {
    return (await get<Guardada>(ruta, elAlmacen()))?.foto ?? null
  } catch {
    return null
  }
}

// Baja la foto desde su dirección y la guarda; después borra las más viejas si pasa el tope. Nunca falla.
export async function guardarBoletaDeDireccion(ruta: string, direccion: string): Promise<void> {
  try {
    if (await boletaEnDispositivo(ruta)) return
    const respuesta = await fetch(direccion)
    if (!respuesta.ok) return
    const foto = await respuesta.blob()
    if (!foto.size) return
    await set(ruta, { foto, guardada: Date.now() } satisfies Guardada, elAlmacen())
    const todas = await entries<string, Guardada>(elAlmacen())
    const borrar = aBorrar(todas.map(([r, v]) => ({ ruta: r, bytes: v.foto.size, guardada: v.guardada })))
    await Promise.all(borrar.map((r) => del(r, elAlmacen())))
  } catch {
    // Sin permiso, sin espacio o sin señal: se ve con señal como siempre
  }
}

// Para Salir: borra todas las fotos guardadas en este dispositivo
export async function borrarBoletasDelDispositivo(): Promise<void> {
  try {
    await clear(elAlmacen())
  } catch {
    // No había nada guardado
  }
}

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { dehydrate, MutationObserver, type DehydrateOptions, type Mutation } from '@tanstack/react-query'
import type { PersistedClient, PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { estaConectado } from './conexion.ts'
import { consultas, type Persona } from './consultas.ts'
import { aplicarPendientes, esErrorDeRed, type Sobre } from './enEspera.ts'
import { modoMaqueta, personaDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Sin señal: lo que se ve queda guardado en el dispositivo (IndexedDB) y lo que se escribe sin conexión (notas,
// gastos, boletas y rendición) queda en espera y sube solo al volver la señal, aunque la app se cierre entremedio.
// Cada escritura lleva un id creado en el dispositivo, así reintentar no duplica nada.

const DIA = 24 * 60 * 60_000
// Cambia cuando cambia la forma de los datos guardados: lo guardado con otra versión se descarta
const ESQUEMA = '20261106010000'
const CLAVE = 'consultas'

// ---------- El almacén del dispositivo ----------
// Se abre recién al usarlo: si el navegador no tiene IndexedDB, la app igual funciona (sin abrir sin señal)
let almacen: UseStore | null = null
function elAlmacen(): UseStore {
  almacen ??= createStore('puente', 'dispositivo')
  return almacen
}

// De quién es lo guardado: la cuenta que entró en este dispositivo, leída sin pedirle nada a la red.
// La maqueta guarda aparte, para no mezclarse con lo real.
function dueno(): string | null {
  if (import.meta.env.DEV && modoMaqueta) return `maqueta-${modoMaqueta}`
  try {
    const clave = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`
    const sesion = JSON.parse(localStorage.getItem(clave) ?? 'null') as { user?: { id?: string } } | null
    return sesion?.user?.id ?? null
  } catch {
    return null
  }
}

// Después de salir no se guarda nada más en esta página (entrar de nuevo recarga la app)
let guardarApagado = false

const persister = createAsyncStoragePersister({
  key: CLAVE,
  throttleTime: 300,
  storage: {
    getItem: async (clave) => {
      const de = dueno()
      return de ? ((await get<string>(`${clave}.${de}`, elAlmacen())) ?? null) : null
    },
    setItem: async (clave, valor) => {
      const de = dueno()
      if (de && !guardarApagado) await set(`${clave}.${de}`, valor, elAlmacen())
    },
    removeItem: async (clave) => {
      const de = dueno()
      if (de) await del(`${clave}.${de}`, elAlmacen())
    },
  },
})

const comoGuardar: DehydrateOptions = {
  // Las direcciones firmadas de las boletas vencen en una hora: no vale la pena guardarlas
  shouldDehydrateQuery: (consulta) => consulta.state.status === 'success' && consulta.queryKey[0] !== 'boleta',
  // Lo que espera, también lo que estaba subiendo cuando se cerró la app (se repite sin duplicar)
  shouldDehydrateMutation: (mutacion) => mutacion.state.status === 'pending' && escrituras.has(nombreDe(mutacion)),
}

// Para PersistQueryClientProvider (main.tsx). Un mes alcanza para todo el viaje aunque no se abra la app unos días.
export const guardadoEnDispositivo: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 30 * DIA,
  buster: ESQUEMA,
  dehydrateOptions: comoGuardar,
}

// Guarda al tiro, sin esperar el turno: lo recién escrito sin señal no se pierde si la app se cierra enseguida
async function guardarYa(): Promise<void> {
  const de = dueno()
  if (!de || guardarApagado) return
  const guardado: PersistedClient = { buster: ESQUEMA, timestamp: Date.now(), clientState: dehydrate(consultas, comoGuardar) }
  try {
    await set(`${CLAVE}.${de}`, JSON.stringify(guardado), elAlmacen())
  } catch {
    // Sin almacenamiento solo no sobrevive a cerrar la app
  }
}

// ---------- Lo que se escribe ----------
// Cada escritura dice cómo se hace en la base, cómo se ve antes de subir (sobre los datos de cada consulta) y qué
// id marca como "sin subir". Lo que espera se hace de a uno y en orden: la boleta y la rendición de un gasto
// anotado sin señal suben después del gasto.
export type Escritura<V, R> = {
  hacer: (variables: V) => Promise<R>
  sobre: Record<string, (datos: never, variables: V) => unknown>
  id: (variables: V) => string
  recargar: string[]
}

type EscrituraGuardada = { sobre: Record<string, Sobre>; id: (variables: unknown) => string }
const escrituras = new Map<string, EscrituraGuardada>()

type Mutacion = Mutation<unknown, Error, unknown, unknown>
function nombreDe(mutacion: Mutacion): string {
  return String(mutacion.options.mutationKey?.[0] ?? '')
}

export function registrarEscritura<V, R>(nombre: string, escritura: Escritura<V, R>): void {
  escrituras.set(nombre, escritura as unknown as EscrituraGuardada)
  consultas.setMutationDefaults<R, Error, V>([nombre], {
    mutationFn: escritura.hacer,
    scope: { id: 'sin-senal' },
    networkMode: 'online',
    // Sin señal o con señal mala se reintenta (cada vez más espaciado, hasta un minuto); si la base lo rechaza, no
    retry: (_veces, error) => esErrorDeRed(error) || !estaConectado(),
    retryDelay: (veces) => Math.min(2000 * 2 ** veces, 60_000),
    // Se ve al tiro, antes de subir
    onMutate: (variables) => {
      for (const [clave, poner] of Object.entries(escritura.sobre)) {
        consultas.setQueryData([clave], (datos: unknown) => (datos === undefined ? undefined : (poner as (d: unknown, v: V) => unknown)(datos, variables)))
      }
    },
    onSettled: () => Promise.all(escritura.recargar.map((clave) => consultas.invalidateQueries({ queryKey: [clave] }))),
  })
}

// Escribe y devuelve lo que contesta la base; si queda en espera (sin señal), devuelve al tiro "enEspera"
// (lo mismo que se ve en las listas) y sube después.
export function escribir<V, R>(nombre: string, variables: V, enEspera: R): Promise<R> {
  const observador = new MutationObserver<R, Error, V>(consultas, { mutationKey: [nombre] })
  return new Promise<R>((listo, falla) => {
    let esperando = false
    const quitar = observador.subscribe((estado) => {
      if (esperando || estado.status !== 'pending' || !(estado.isPaused || estado.failureCount > 0)) return
      esperando = true
      quitar()
      void guardarYa().then(() => listo(enEspera))
    })
    observador
      .mutate(variables)
      .then(listo, falla)
      .finally(quitar)
  })
}

function enEsperaAhora(): Mutacion[] {
  return consultas
    .getMutationCache()
    .getAll()
    .filter((mutacion) => mutacion.state.status === 'pending' && escrituras.has(nombreDe(mutacion)))
}

// Los datos de una consulta con lo que todavía no sube encima (cada consulta lo usa al traer de la base)
export function conPendientes<T>(clave: string, datos: T): T {
  const pendientes = enEsperaAhora().map((mutacion) => ({ nombre: nombreDe(mutacion), variables: mutacion.state.variables }))
  return aplicarPendientes(clave, datos, pendientes, (nombre, deClave) => escrituras.get(nombre)?.sobre[deClave])
}

// Lo que espera de un tipo
export function pendientesDe<V>(nombre: string): V[] {
  return enEsperaAhora()
    .filter((mutacion) => nombreDe(mutacion) === nombre)
    .map((mutacion) => mutacion.state.variables as V)
}

// Deshacer algo que todavía no empezó a subir: se saca de la espera (quien llama lo saca de las listas).
// Devuelve lo que se soltó, o null si no estaba esperando.
export function soltarPendiente<V>(nombre: string, cumple: (variables: V) => boolean): V | null {
  const mutacion = enEsperaAhora().find((m) => nombreDe(m) === nombre && m.state.isPaused && cumple(m.state.variables as V))
  if (!mutacion) return null
  consultas.getMutationCache().remove(mutacion)
  return mutacion.state.variables as V
}

// Corregir algo que todavía no empezó a subir (sin señal): cambia lo que espera, sin perder su lugar en la fila.
// Devuelve lo que quedó, o null si no estaba esperando.
export function cambiarPendiente<V extends object>(nombre: string, cumple: (variables: V) => boolean, cambiar: (variables: V) => V): V | null {
  const mutacion = enEsperaAhora().find((m) => nombreDe(m) === nombre && m.state.isPaused && cumple(m.state.variables as V))
  if (!mutacion) return null
  // Es el mismo objeto que se va a subir
  const variables = Object.assign(mutacion.state.variables as V, cambiar(mutacion.state.variables as V))
  void guardarYa()
  return variables
}

// Al abrir la app: lo que quedó esperando sigue (si no hay señal, espera de nuevo).
// Va en onSuccess de PersistQueryClientProvider; no espera a que suba, para no atrasar la app.
export function alRestaurar(): void {
  const restauradas = enEsperaAhora()
  for (const mutacion of restauradas) esperaron.add(mutacion)
  avisarSinSubir()
  for (const mutacion of restauradas) void mutacion.continue().catch(() => undefined)
}

// Antes de escribir en la base: la sesión tiene que estar (con señal mala, renovarla puede fallar y la escritura
// iría sin cuenta). Sin sesión cuenta como problema de red: se reintenta.
export async function asegurarSesion(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const error = new Error('Todavía sin sesión')
  error.name = 'SinSesion'
  throw error
}

// Tu id de persona, para lo que se ve antes de subir (la base pone el de verdad)
export function miId(): string {
  if (import.meta.env.DEV && modoMaqueta) return personaDeMaqueta().id
  const usuario = dueno()
  const deLaLista = consultas.getQueryData<Persona[]>(['personas'])?.find((p) => p.usuario === usuario)
  if (deLaLista) return deLaLista.id
  try {
    const guardada = JSON.parse(localStorage.getItem('puente.persona') ?? 'null') as Persona | null
    return guardada?.usuario === usuario ? guardada.id : ''
  } catch {
    return ''
  }
}

// ---------- Fotos de boletas que esperan ----------
// Lo guardado como JSON no lleva fotos: cada una espera aparte, con el id de su gasto. También en memoria, por si
// el navegador no deja guardar.
export type BoletaGuardada = { ruta: string; foto: Blob }
const boletasEnMemoria = new Map<string, BoletaGuardada>()

export async function guardarBoleta(gasto: string, boleta: BoletaGuardada): Promise<void> {
  boletasEnMemoria.set(gasto, boleta)
  try {
    await set(`boleta.${gasto}`, boleta, elAlmacen())
  } catch {
    // Queda en memoria: sube si la app no se cierra antes
  }
}

export async function boletaGuardada(gasto: string): Promise<BoletaGuardada | null> {
  const enMemoria = boletasEnMemoria.get(gasto)
  if (enMemoria) return enMemoria
  try {
    return (await get<BoletaGuardada>(`boleta.${gasto}`, elAlmacen())) ?? null
  } catch {
    return null
  }
}

export async function soltarBoleta(gasto: string): Promise<void> {
  boletasEnMemoria.delete(gasto)
  try {
    await del(`boleta.${gasto}`, elAlmacen())
  } catch {
    // No estaba guardada
  }
}

// ---------- Sin subir ----------
// Ids de lo que todavía no sube: ids de gastos, de notas de contactos, "reunion:<id del evento>" para notas de
// reunión, "boleta:<id del gasto>" para fotos y "rendicion:<id del gasto>" para lo que marcaste que rindes.
// Cuenta lo que tuvo que esperar (sin señal o reintentando), no lo que sube al tiro con señal.
const esperaron = new WeakSet<Mutacion>()
let sinSubir: ReadonlySet<string> = new Set()
const oyentes = new Set<() => void>()

function avisarSinSubir() {
  const ids: string[] = []
  for (const mutacion of enEsperaAhora()) {
    if (mutacion.state.isPaused || mutacion.state.failureCount > 0) esperaron.add(mutacion)
    const escritura = escrituras.get(nombreDe(mutacion))
    if (escritura && esperaron.has(mutacion)) ids.push(escritura.id(mutacion.state.variables))
  }
  const nuevos = new Set(ids)
  if (nuevos.size === sinSubir.size && ids.every((id) => sinSubir.has(id))) return
  sinSubir = nuevos
  for (const oyente of oyentes) oyente()
}
consultas.getMutationCache().subscribe(avisarSinSubir)

// Lo mismo, fuera de React
export function sinSubirAhora(): ReadonlySet<string> {
  return sinSubir
}

export function useSinSubir(): ReadonlySet<string> {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => {
        oyentes.delete(oyente)
      }
    },
    () => sinSubir,
  )
}

// Cuánto falta subir, por tipo, para avisar antes de salir (salir lo borra): gastos (con su foto y su rendición),
// notas (de contactos y de reunión) y otros cambios (la foto o la rendición de un gasto que ya subió)
export type CuantoSinSubir = { gastos: number; notas: number; otros: number }

export function cuantoSinSubir(): CuantoSinSubir {
  const porNombre = new Map<string, string[]>()
  for (const mutacion of enEsperaAhora()) {
    const nombre = nombreDe(mutacion)
    const escritura = escrituras.get(nombre)
    if (!escritura || !esperaron.has(mutacion)) continue
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), escritura.id(mutacion.state.variables)])
  }
  const gastos = new Set(porNombre.get('anotarGasto'))
  // "boleta:<id>" y "rendicion:<id>" de un gasto que tampoco ha subido ya cuentan con ese gasto
  const otros = [...(porNombre.get('subirBoleta') ?? []), ...(porNombre.get('rendir') ?? [])].filter((id) => !gastos.has(id.slice(id.indexOf(':') + 1)))
  const notas = (porNombre.get('agregarNota')?.length ?? 0) + (porNombre.get('notaReunion')?.length ?? 0)
  return { gastos: gastos.size, notas, otros: otros.length }
}

export function useCuantoSinSubir(): CuantoSinSubir {
  // Vuelve a contar cada vez que cambia lo que falta subir
  useSinSubir()
  return cuantoSinSubir()
}

// Al salir se borra lo guardado en este dispositivo (datos, lo que esperaba y las fotos), para que otra cuenta no lo vea
export async function limpiarEsteDispositivo(): Promise<void> {
  guardarApagado = true
  consultas.clear()
  boletasEnMemoria.clear()
  try {
    await clear(elAlmacen())
  } catch {
    // Sin almacenamiento no había nada guardado
  }
}

import { useQuery } from '@tanstack/react-query'
import type { Json, Tables } from './base.ts'
import { consultas } from './consultas.ts'
import { leerFoto } from './fotos.ts'
import { plano } from './grupo.ts'
import { conBoleta, conGasto, conPartes, conRendicion, ordenDeGastos } from './enEspera.ts'
import { boletaDeMaqueta, cambiarGastosDeMaqueta, gastosDeMaqueta, modoMaqueta, personaDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'
import { transferencias, type Transferencia } from './saldar.ts'
import {
  asegurarSesion,
  boletaGuardada,
  cambiarPendiente,
  conPendientes,
  escribir,
  guardarBoleta,
  miId,
  pendientesDe,
  registrarEscritura,
  soltarBoleta,
  soltarPendiente,
  type BoletaGuardada,
} from './sinSenal.ts'

// Gastos del viaje: todo en dólares, guardado en centavos. Un gasto "solo" es de una persona: no se divide y solo
// ella lo ve. Anotar y cambiar pasan por funciones de la base que revisan que las partes sumen el total.
// Sin señal se puede anotar (con foto) y marcar qué rindes: queda en espera y sube después (sinSenal.ts).

export type Gasto = Tables<'gastos'>
export type Parte = Tables<'partes'>
export type Pago = Tables<'pagos'>
export type Rendicion = Tables<'rendiciones'>
export type Division = 'iguales' | 'exactos' | 'solo'
export const CATEGORIAS = ['auto', 'tren', 'bici', 'comida', 'cafe', 'super', 'entrada', 'otro'] as const
export type Categoria = (typeof CATEGORIAS)[number]
export type { Transferencia }

// ---------- Plata ----------
// Formato y lectura de montos según el idioma (en plata.ts, que se prueba aparte)
export { aCentavos, plata } from './plata.ts'

// Partes iguales: los centavos que sobran van a los primeros de la lista, para que la suma dé exacta
export function repartirIguales(monto: number, personas: string[]): { persona: string; monto: number }[] {
  const base = Math.floor(monto / personas.length)
  const sobran = monto - base * personas.length
  return personas.map((persona, i) => ({ persona, monto: base + (i < sobran ? 1 : 0) }))
}

// El ícono se elige solo según lo que se escribe (y se puede cambiar)
const PISTAS: [Categoria, RegExp][] = [
  ['auto', /uber|lyft|taxi|auto|estacionamiento|bencina|gasolina|peaje/],
  ['tren', /caltrain|tren|bart|metro|muni|bus\b|micro/],
  ['bici', /bici|bike|scooter|patineta/],
  ['cafe', /cafe|coffee|starbucks|philz|blue bottle/],
  ['comida', /cena|almuerzo|desayuno|comida|restaurant|pizza|burger|sushi|taco|food|once/],
  ['super', /super|walmart|trader|safeway|costco|whole foods|target|farmacia|cvs|walgreens/],
  ['entrada', /entrada|ticket|museo|museum|tour|parque|park|concierto|partido/],
]
export function categoriaDe(titulo: string): Categoria {
  const t = plano(titulo)
  return PISTAS.find(([, pista]) => pista.test(t))?.[0] ?? 'otro'
}

// ---------- Lo que hay ----------
// Los gastos que ves, sin los eliminados, del más nuevo al más viejo
export function useGastos() {
  return useQuery({
    queryKey: ['gastos'],
    queryFn: async (): Promise<Gasto[]> => {
      if (import.meta.env.DEV && modoMaqueta) {
        return conPendientes(
          'gastos',
          gastosDeMaqueta()
            .gastos.filter((g) => !g.borrado_en)
            .sort(ordenDeGastos),
        )
      }
      const { data, error } = await supabase.from('gastos').select('*').is('borrado_en', null).order('fecha', { ascending: false }).order('creado_en', { ascending: false })
      if (error) throw error
      return conPendientes('gastos', data)
    },
  })
}

// Las partes de los gastos que ves (las de los eliminados también, para deshacer)
export function usePartes() {
  return useQuery({
    queryKey: ['partes'],
    queryFn: async (): Promise<Parte[]> => {
      if (import.meta.env.DEV && modoMaqueta) return conPendientes('partes', gastosDeMaqueta().partes)
      const { data, error } = await supabase.from('partes').select('*')
      if (error) throw error
      return conPendientes('partes', data)
    },
  })
}

export function usePagos() {
  return useQuery({
    queryKey: ['pagos'],
    queryFn: async (): Promise<Pago[]> => {
      if (import.meta.env.DEV && modoMaqueta) return gastosDeMaqueta().pagos.filter((p) => !p.borrado_en)
      const { data, error } = await supabase.from('pagos').select('*').is('borrado_en', null).order('creado_en')
      if (error) throw error
      return data
    },
  })
}

// Los gastos que rindes (solo los tuyos)
export function useRendiciones() {
  return useQuery({
    queryKey: ['rendiciones'],
    queryFn: async (): Promise<Rendicion[]> => {
      if (import.meta.env.DEV && modoMaqueta) return conPendientes('rendiciones', gastosDeMaqueta().rendiciones)
      const { data, error } = await supabase.from('rendiciones').select('*')
      if (error) throw error
      return conPendientes('rendiciones', data)
    },
  })
}

// ---------- Cuentas ----------
export function partesDe(gasto: string, partes: Parte[]): Parte[] {
  return partes.filter((p) => p.gasto === gasto)
}

// Saldo de cada uno, en centavos: lo que pagó menos su parte, más lo que transfirió menos lo que recibió.
// Positivo: le deben; negativo: debe. Los gastos "solo" no cuentan. Todos los de "personas" aparecen, aunque sea en 0.
export function saldos(gastos: Gasto[], partes: Parte[], pagos: Pago[], personas: string[]): Record<string, number> {
  const saldo: Record<string, number> = Object.fromEntries(personas.map((p) => [p, 0]))
  const sumar = (persona: string, monto: number) => (saldo[persona] = (saldo[persona] ?? 0) + monto)
  const compartidos = new Map(gastos.filter((g) => g.division !== 'solo').map((g) => [g.id, g]))
  for (const g of compartidos.values()) sumar(g.pagado_por, g.monto)
  for (const p of partes) if (compartidos.has(p.gasto)) sumar(p.persona, -p.monto)
  for (const p of pagos) {
    sumar(p.de, p.monto)
    sumar(p.a, -p.monto)
  }
  return saldo
}

// Cómo saldar: las menos transferencias posibles. Los gastos y sus partes se cargan por separado, así que por un
// instante los saldos pueden no cuadrar (un gasto nuevo sin sus partes): entonces todavía no hay nada que mostrar.
export function comoSaldar(saldo: Record<string, number>): Transferencia[] {
  if (Object.values(saldo).reduce((suma, monto) => suma + monto, 0) !== 0) return []
  return transferencias(saldo)
}

// Lo cambian quien lo anotó, quien pagó o quien administra; uno "solo", únicamente su dueño (como en la base)
export function puedeCambiarGasto(gasto: Gasto, yo: { id: string; administra: boolean }): boolean {
  if (gasto.division === 'solo') return gasto.pagado_por === yo.id
  return gasto.creado_por === yo.id || gasto.pagado_por === yo.id || yo.administra
}

// Tu relación con un gasto, como la muestra la lista: "prestaste" (pagaste y otros te deben), "te prestaron"
// (pagó otro y tienes parte), "no participas" o "solo tuyo". El monto va en centavos.
export type Conmigo = { tipo: 'prestaste' | 'teprestaron' | 'noparticipas' | 'solotuyo'; monto: number }
export function conmigo(gasto: Gasto, partes: Parte[], yo: string): Conmigo {
  if (gasto.division === 'solo') return { tipo: 'solotuyo', monto: gasto.monto }
  const mia = partesDe(gasto.id, partes).find((p) => p.persona === yo)?.monto ?? 0
  // Pagado por ti y entero tuyo sin ser "Solo mío" (por ejemplo, montos exactos solo para ti): no prestaste nada
  if (gasto.pagado_por === yo && mia === gasto.monto) return { tipo: 'solotuyo', monto: gasto.monto }
  if (gasto.pagado_por === yo) return { tipo: 'prestaste', monto: gasto.monto - mia }
  return mia > 0 ? { tipo: 'teprestaron', monto: mia } : { tipo: 'noparticipas', monto: 0 }
}

// ---------- Anotar, cambiar y eliminar ----------
export type DatosGasto = {
  titulo: string
  categoria: Categoria
  monto: number
  fecha: string
  pagado_por: string
  division: Division
  // Las partes de cada uno (en "solo" se ignoran: es entero de quien pagó)
  partes: { persona: string; monto: number }[]
}

const recargar = (...claves: string[]) => Promise.all(claves.map((clave) => consultas.invalidateQueries({ queryKey: [clave] })))
const ahoraIso = () => new Date().toISOString()

// Las partes como quedan en la base
function partesFinales(datos: DatosGasto): { persona: string; monto: number }[] {
  return datos.division === 'solo' ? [{ persona: datos.pagado_por, monto: datos.monto }] : datos.partes
}

// Anotar funciona sin señal: el gasto lleva un id creado aquí y, si la base ya lo tiene (un reintento), lo devuelve
// sin duplicarlo. Sin señal devuelve al tiro el gasto como se verá; sube cuando vuelva la señal.
type Anotar = { gasto: Gasto; partes: Parte[] }
registrarEscritura<Anotar, Gasto>('anotarGasto', {
  hacer: async ({ gasto, partes }) => {
    if (import.meta.env.DEV && modoMaqueta) {
      // Como la base: si ya está, no se duplica
      if (!gastosDeMaqueta().gastos.some((g) => g.id === gasto.id)) cambiarGastosDeMaqueta((d) => ({ ...d, gastos: [gasto, ...d.gastos], partes: [...d.partes, ...partes] }))
      return gastosDeMaqueta().gastos.find((g) => g.id === gasto.id) ?? gasto
    }
    await asegurarSesion()
    const { id, titulo, categoria, monto, fecha, pagado_por, division } = gasto
    const { data, error } = await supabase.rpc('anotar_gasto', {
      id,
      titulo,
      categoria,
      monto,
      fecha,
      pagado_por,
      division,
      partes: partes.map((p) => ({ persona: p.persona, monto: p.monto })) as unknown as Json,
    })
    if (!error) return data
    // Dos intentos a la vez (dos pestañas): si ya quedó, vale
    if (error.code === '23505') {
      const ya = await supabase.from('gastos').select('*').eq('id', id).maybeSingle()
      if (ya.data) return ya.data
    }
    throw error
  },
  sobre: {
    gastos: (lista: Gasto[], { gasto }) => conGasto(lista, gasto),
    partes: (lista: Parte[], { partes }) => conPartes(lista, partes),
  },
  id: ({ gasto }) => gasto.id,
  recargar: ['gastos', 'partes'],
})

export function anotarGasto(datos: DatosGasto): Promise<Gasto> {
  const ahora = ahoraIso()
  const gasto: Gasto = {
    id: crypto.randomUUID(),
    titulo: datos.titulo.trim(),
    categoria: datos.categoria,
    monto: datos.monto,
    fecha: datos.fecha,
    pagado_por: datos.pagado_por,
    division: datos.division,
    boleta: null,
    creado_por: miId(),
    creado_en: ahora,
    cambiado_en: ahora,
    borrado_en: null,
  }
  const partes = partesFinales(datos).map((p) => ({ gasto: gasto.id, persona: p.persona, monto: p.monto }))
  return escribir<Anotar, Gasto>('anotarGasto', { gasto, partes }, gasto)
}

// Cambiar necesita señal, salvo un gasto anotado sin señal que todavía no sube: se corrige lo que espera
export async function cambiarGasto(id: string, datos: DatosGasto): Promise<Gasto> {
  const corregido = cambiarPendiente<Anotar>(
    'anotarGasto',
    (v) => v.gasto.id === id,
    ({ gasto }) => ({
      gasto: { ...gasto, titulo: datos.titulo.trim(), categoria: datos.categoria, monto: datos.monto, fecha: datos.fecha, pagado_por: datos.pagado_por, division: datos.division, cambiado_en: ahoraIso() },
      partes: partesFinales(datos).map((p) => ({ gasto: id, persona: p.persona, monto: p.monto })),
    }),
  )
  if (corregido) {
    consultas.setQueryData<Gasto[]>(['gastos'], (lista) => lista && conGasto(lista.filter((g) => g.id !== id), corregido.gasto))
    consultas.setQueryData<Parte[]>(['partes'], (lista) => lista && [...lista.filter((p) => p.gasto !== id), ...corregido.partes])
    return corregido.gasto
  }
  let cambiado: Gasto
  if (import.meta.env.DEV && modoMaqueta) {
    const antes = gastosDeMaqueta().gastos.find((g) => g.id === id)
    if (!antes) throw new Error('No existe ese gasto')
    const { partes: _partes, ...resto } = datos
    cambiado = { ...antes, ...resto, cambiado_en: ahoraIso() }
    cambiarGastosDeMaqueta((d) => ({
      ...d,
      gastos: d.gastos.map((g) => (g.id === id ? cambiado : g)),
      partes: [...d.partes.filter((p) => p.gasto !== id), ...partesFinales(datos).map((p) => ({ gasto: id, ...p }))],
    }))
  } else {
    const { partes, ...resto } = datos
    const { data, error } = await supabase.rpc('cambiar_gasto', { gasto: id, ...resto, partes: partes as unknown as Json })
    if (error) throw error
    cambiado = data
  }
  await recargar('gastos', 'partes')
  return cambiado
}

// Lo anotado sin señal que se eliminó antes de subir, para poder devolverlo (Deshacer)
const soltados = new Map<string, { anotado: Anotar; boleta: Boleta | null; foto: BoletaGuardada | null }>()

// Si el gasto todavía no sube, eliminarlo es sacarlo de la espera (con su foto y su rendición): no hace falta señal
async function soltarGasto(id: string): Promise<boolean> {
  const anotado = soltarPendiente<Anotar>('anotarGasto', (v) => v.gasto.id === id)
  if (!anotado) return false
  const boleta = soltarPendiente<Boleta>('subirBoleta', (v) => v.gasto === id)
  soltados.set(id, { anotado, boleta, foto: boleta && (await boletaGuardada(id)) })
  while (soltarPendiente<Rendir>('rendir', (v) => v.gasto === id));
  await soltarBoleta(id)
  consultas.setQueryData<Gasto[]>(['gastos'], (lista) => lista?.filter((g) => g.id !== id))
  consultas.setQueryData<Parte[]>(['partes'], (lista) => lista?.filter((p) => p.gasto !== id))
  consultas.setQueryData<Rendicion[]>(['rendiciones'], (lista) => lista?.filter((r) => r.gasto !== id))
  return true
}

// Eliminar deja el gasto aparte; "devolver" lo deshace
export async function borrarGasto(id: string): Promise<void> {
  if (await soltarGasto(id)) return
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === id ? { ...g, borrado_en: ahoraIso() } : g)) }))
  } else {
    const { error } = await supabase.rpc('borrar_gasto', { gasto: id })
    if (error) throw error
  }
  await recargar('gastos')
}

export async function devolverGasto(id: string): Promise<void> {
  const soltado = soltados.get(id)
  if (soltado) {
    soltados.delete(id)
    await escribir<Anotar, Gasto>('anotarGasto', soltado.anotado, soltado.anotado.gasto)
    if (soltado.boleta && soltado.foto) {
      await guardarBoleta(id, soltado.foto)
      await escribir<Boleta, void>('subirBoleta', soltado.boleta, undefined)
    }
    return
  }
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === id ? { ...g, borrado_en: null } : g)) }))
  } else {
    const { error } = await supabase.rpc('devolver_gasto', { gasto: id })
    if (error) throw error
  }
  await recargar('gastos')
}

// ---------- La boleta ----------
// La foto de la boleta, achicada a 1600 px por lado en JPEG (va a un espacio privado)
export async function prepararBoleta(archivo: Blob): Promise<Blob> {
  const imagen = await leerFoto(archivo)
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  imagen.close()
  return new Promise((listo, falla) => lienzo.toBlob((blob) => (blob ? listo(blob) : falla(new Error('No se pudo preparar la foto'))), 'image/jpeg', 0.82))
}

// Sube la foto a la carpeta del gasto y la deja puesta; borra la que hubiera antes. Sin señal la foto espera en el
// dispositivo (con el id del gasto) y se sube cuando vuelve la señal; la ruta se elige antes, así reintentar no la
// duplica. Mientras espera, la boleta se ve desde el dispositivo.
type Boleta = { gasto: string; ruta: string; anterior: string | null }
registrarEscritura<Boleta, void>('subirBoleta', {
  hacer: async ({ gasto, ruta, anterior }) => {
    const guardada = await boletaGuardada(gasto)
    // Si la foto ya no está o la cambiaron por otra (que también espera), esta no sube
    if (guardada?.ruta !== ruta) return
    if (import.meta.env.DEV && modoMaqueta) {
      cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === gasto ? { ...g, boleta: ruta } : g)) }))
    } else {
      await asegurarSesion()
      const subida = await supabase.storage.from('boletas').upload(ruta, guardada.foto, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (subida.error && !yaExiste(subida.error)) throw subida.error
      const { error } = await supabase.rpc('poner_boleta', { gasto, ruta })
      if (error) throw error
      if (anterior && anterior !== ruta) await supabase.storage.from('boletas').remove([anterior])
    }
    await soltarBoleta(gasto)
  },
  sobre: { gastos: (lista: Gasto[], { gasto, ruta }) => conBoleta(lista, gasto, ruta) },
  id: ({ gasto }) => `boleta:${gasto}`,
  recargar: ['gastos'],
})

// Un reintento de una foto que ya había subido
function yaExiste(error: { message?: string; statusCode?: string | number }): boolean {
  return String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message ?? '')
}

export async function subirBoleta(gasto: Gasto, foto: Blob): Promise<void> {
  const ruta = `${gasto.id}/${crypto.randomUUID()}.jpg`
  // Si otra foto de este gasto esperaba, la de antes sigue siendo la que estaba en la base
  const previa = pendientesDe<Boleta>('subirBoleta').find((v) => v.gasto === gasto.id)
  const anterior = previa ? previa.anterior : gasto.boleta
  await guardarBoleta(gasto.id, { ruta, foto })
  await escribir<Boleta, void>('subirBoleta', { gasto: gasto.id, ruta, anterior }, undefined)
}

export async function quitarBoleta(gasto: Gasto): Promise<void> {
  // Una foto que todavía no subía se suelta sin señal; si había otra antes en la base, esa se quita como siempre
  const esperaba = soltarPendiente<Boleta>('subirBoleta', (v) => v.gasto === gasto.id)
  if (esperaba) {
    await soltarBoleta(gasto.id)
    consultas.setQueryData<Gasto[]>(['gastos'], (lista) => lista && conBoleta(lista, gasto.id, esperaba.anterior))
    if (!esperaba.anterior) return
    gasto = { ...gasto, boleta: esperaba.anterior }
  }
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === gasto.id ? { ...g, boleta: null } : g)) }))
  } else {
    const { error } = await supabase.rpc('poner_boleta', { gasto: gasto.id })
    if (error) throw error
    if (gasto.boleta) await supabase.storage.from('boletas').remove([gasto.boleta])
  }
  await recargar('gastos')
}

// La foto que todavía espera en el dispositivo, para verla antes de que suba
async function urlLocal(ruta: string): Promise<string | null> {
  const guardada = await boletaGuardada(ruta.split('/')[0] ?? '')
  return guardada?.ruta === ruta ? URL.createObjectURL(guardada.foto) : null
}

// Una dirección para ver la boleta por una hora (el espacio es privado); la que espera se ve desde el dispositivo
export function useUrlBoleta(ruta: string | null) {
  return useQuery({
    queryKey: ['boleta', ruta],
    enabled: Boolean(ruta),
    staleTime: 50 * 60_000,
    // Sin señal también busca: la foto puede estar esperando aquí
    networkMode: 'always',
    queryFn: async (): Promise<string> => {
      const local = await urlLocal(ruta ?? '')
      if (local) return local
      if (import.meta.env.DEV && modoMaqueta) return boletaDeMaqueta()
      const { data, error } = await supabase.storage.from('boletas').createSignedUrl(ruta ?? '', 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

// Direcciones para bajar varias boletas a la vez (la rendición), en el mismo orden que las rutas
export async function urlsDeBoletas(rutas: string[]): Promise<string[]> {
  if (!rutas.length) return []
  // Las que esperan en el dispositivo no se piden a la base
  const locales = await Promise.all(rutas.map(urlLocal))
  const faltan = rutas.filter((_, i) => !locales[i])
  let firmadas: { path: string | null; signedUrl: string | null }[] = []
  if (import.meta.env.DEV && modoMaqueta) firmadas = faltan.map((ruta) => ({ path: ruta, signedUrl: boletaDeMaqueta() }))
  else if (faltan.length) {
    const { data, error } = await supabase.storage.from('boletas').createSignedUrls(faltan, 600)
    if (error) throw error
    firmadas = data
  }
  return rutas.map((ruta, i) => {
    const direccion = locales[i] ?? firmadas.find((d) => d.path === ruta)?.signedUrl
    if (!direccion) throw new Error(`No se encontró la boleta ${ruta}`)
    return direccion
  })
}

// ---------- Saldar ----------
// Quien transfiere lo marca como pagado; se puede deshacer
export async function marcarPagado(a: string, monto: number): Promise<Pago> {
  let pago: Pago
  if (import.meta.env.DEV && modoMaqueta) {
    pago = { id: `pago-${Date.now()}`, de: personaDeMaqueta().id, a, monto, creado_en: ahoraIso(), borrado_en: null }
    cambiarGastosDeMaqueta((d) => ({ ...d, pagos: [...d.pagos, pago] }))
  } else {
    const { data, error } = await supabase.rpc('marcar_pagado', { a, monto })
    if (error) throw error
    pago = data
  }
  await recargar('pagos')
  return pago
}

export async function deshacerPago(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, pagos: d.pagos.map((p) => (p.id === id ? { ...p, borrado_en: ahoraIso() } : p)) }))
  } else {
    const { error } = await supabase.rpc('deshacer_pago', { pago: id })
    if (error) throw error
  }
  await recargar('pagos')
}

// ---------- Rendición ----------
// Marcar qué rindes funciona sin señal; marcar o desmarcar dos veces deja lo mismo
type Rendir = { gasto: string; si: boolean; persona: string; marcado_en: string }
registrarEscritura<Rendir, void>('rendir', {
  hacer: async ({ gasto, si, persona, marcado_en }) => {
    if (import.meta.env.DEV && modoMaqueta) {
      cambiarGastosDeMaqueta((d) => ({ ...d, rendiciones: conRendicion(d.rendiciones, { gasto, si, persona, marcado_en }) }))
      return
    }
    await asegurarSesion()
    if (si) {
      const { error } = await supabase.from('rendiciones').upsert({ gasto }, { onConflict: 'gasto,persona', ignoreDuplicates: true })
      if (error) throw error
    } else {
      const { error } = await supabase.from('rendiciones').delete().eq('gasto', gasto)
      if (error) throw error
    }
  },
  sobre: { rendiciones: (lista: Rendicion[], cambio) => conRendicion(lista, cambio) },
  id: ({ gasto }) => `rendicion:${gasto}`,
  recargar: ['rendiciones'],
})

export function rendir(gasto: string, si: boolean): Promise<void> {
  return escribir<Rendir, void>('rendir', { gasto, si, persona: miId(), marcado_en: ahoraIso() }, undefined)
}

import { useQuery } from '@tanstack/react-query'
import type { Json, Tables } from './base.ts'
import { consultas } from './consultas.ts'
import { leerFoto } from './fotos.ts'
import { plano } from './grupo.ts'
import { boletaDeMaqueta, cambiarGastosDeMaqueta, gastosDeMaqueta, modoMaqueta, personaDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'
import { transferencias, type Transferencia } from './saldar.ts'

// Gastos del viaje: todo en dólares, guardado en centavos. Un gasto "solo" es de una persona: no se divide y solo
// ella lo ve. Anotar y cambiar pasan por funciones de la base que revisan que las partes sumen el total.

export type Gasto = Tables<'gastos'>
export type Parte = Tables<'partes'>
export type Pago = Tables<'pagos'>
export type Rendicion = Tables<'rendiciones'>
export type Division = 'iguales' | 'exactos' | 'solo'
export const CATEGORIAS = ['auto', 'tren', 'bici', 'comida', 'cafe', 'super', 'entrada', 'otro'] as const
export type Categoria = (typeof CATEGORIAS)[number]
export type { Transferencia }

// ---------- Plata ----------
// "US$ 1.234,56": formato chileno, siempre con centavos
export function plata(centavos: number): string {
  const abs = Math.abs(centavos)
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${centavos < 0 ? '-' : ''}US$ ${enteros},${String(abs % 100).padStart(2, '0')}`
}

// Lo que alguien escribe como monto ("84", "84,5", "1.234,56" o "84.50") en centavos; null si no es un monto
export function aCentavos(texto: string): number | null {
  let t = texto
    .trim()
    .replace(/^US\$/i, '')
    .replace(/\s/g, '')
  if (!t) return null
  // Con coma, la coma es la de los decimales y los puntos son de miles; sin coma, un punto con 3 cifras es de miles
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

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
        return gastosDeMaqueta()
          .gastos.filter((g) => !g.borrado_en)
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))
      }
      const { data, error } = await supabase.from('gastos').select('*').is('borrado_en', null).order('fecha', { ascending: false }).order('creado_en', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Las partes de los gastos que ves (las de los eliminados también, para deshacer)
export function usePartes() {
  return useQuery({
    queryKey: ['partes'],
    queryFn: async (): Promise<Parte[]> => {
      if (import.meta.env.DEV && modoMaqueta) return gastosDeMaqueta().partes
      const { data, error } = await supabase.from('partes').select('*')
      if (error) throw error
      return data
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
      if (import.meta.env.DEV && modoMaqueta) return gastosDeMaqueta().rendiciones
      const { data, error } = await supabase.from('rendiciones').select('*')
      if (error) throw error
      return data
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

export async function anotarGasto(datos: DatosGasto): Promise<Gasto> {
  let anotado: Gasto
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    anotado = { id: `gasto-${Date.now()}`, ...datos, boleta: null, creado_por: yo, creado_en: ahoraIso(), cambiado_en: ahoraIso(), borrado_en: null }
    cambiarGastosDeMaqueta((d) => ({
      ...d,
      gastos: [anotado, ...d.gastos],
      partes: [...d.partes, ...partesFinales(datos).map((p) => ({ gasto: anotado.id, ...p }))],
    }))
  } else {
    const { partes, ...resto } = datos
    const { data, error } = await supabase.rpc('anotar_gasto', { ...resto, partes: partes as unknown as Json })
    if (error) throw error
    anotado = data
  }
  await recargar('gastos', 'partes')
  return anotado
}

export async function cambiarGasto(id: string, datos: DatosGasto): Promise<Gasto> {
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

// Eliminar deja el gasto aparte; "devolver" lo deshace
export async function borrarGasto(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === id ? { ...g, borrado_en: ahoraIso() } : g)) }))
  } else {
    const { error } = await supabase.rpc('borrar_gasto', { gasto: id })
    if (error) throw error
  }
  await recargar('gastos')
}

export async function devolverGasto(id: string): Promise<void> {
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

// Sube la foto a la carpeta del gasto y la deja puesta; borra la que hubiera antes
export async function subirBoleta(gasto: Gasto, foto: Blob): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === gasto.id ? { ...g, boleta: `${gasto.id}/maqueta.jpg` } : g)) }))
  } else {
    const ruta = `${gasto.id}/${crypto.randomUUID()}.jpg`
    const subida = await supabase.storage.from('boletas').upload(ruta, foto, { contentType: 'image/jpeg', cacheControl: '31536000' })
    if (subida.error) throw subida.error
    const { error } = await supabase.rpc('poner_boleta', { gasto: gasto.id, ruta })
    if (error) throw error
    if (gasto.boleta) await supabase.storage.from('boletas').remove([gasto.boleta])
  }
  await recargar('gastos')
}

export async function quitarBoleta(gasto: Gasto): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarGastosDeMaqueta((d) => ({ ...d, gastos: d.gastos.map((g) => (g.id === gasto.id ? { ...g, boleta: null } : g)) }))
  } else {
    const { error } = await supabase.rpc('poner_boleta', { gasto: gasto.id })
    if (error) throw error
    if (gasto.boleta) await supabase.storage.from('boletas').remove([gasto.boleta])
  }
  await recargar('gastos')
}

// Una dirección para ver la boleta por una hora (el espacio es privado)
export function useUrlBoleta(ruta: string | null) {
  return useQuery({
    queryKey: ['boleta', ruta],
    enabled: Boolean(ruta),
    staleTime: 50 * 60_000,
    queryFn: async (): Promise<string> => {
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
  if (import.meta.env.DEV && modoMaqueta) return rutas.map(() => boletaDeMaqueta())
  const { data, error } = await supabase.storage.from('boletas').createSignedUrls(rutas, 600)
  if (error) throw error
  return rutas.map((ruta) => {
    const direccion = data.find((d) => d.path === ruta)?.signedUrl
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
export async function rendir(gasto: string, si: boolean): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    cambiarGastosDeMaqueta((d) => ({
      ...d,
      rendiciones: si ? [...d.rendiciones.filter((r) => r.gasto !== gasto), { gasto, persona: yo, marcado_en: ahoraIso() }] : d.rendiciones.filter((r) => r.gasto !== gasto),
    }))
  } else if (si) {
    const { error } = await supabase.from('rendiciones').upsert({ gasto }, { onConflict: 'gasto,persona', ignoreDuplicates: true })
    if (error) throw error
  } else {
    const { error } = await supabase.from('rendiciones').delete().eq('gasto', gasto)
    if (error) throw error
  }
  await recargar('rendiciones')
}

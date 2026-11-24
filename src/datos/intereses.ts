import { useQuery } from '@tanstack/react-query'
import type { Tables } from './base.ts'
import { consultas, type Persona } from './consultas.ts'
import { soloParaTema, type Evento } from './eventos.ts'
import { cambiarInteresadosDeMaqueta, cambiarTemasDeMaqueta, datosDeMaqueta, interesadosDeMaqueta, modoMaqueta, personaDeMaqueta, temasDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Intereses: temas de interés (Fintech, IA…) a los que cada uno se suma («Me interesa») o de los que sale («Ya no me
// interesa»), y eventos que van primero a los de un tema. Todos ven todo. Todo cambio pasa por funciones de la base
// (20261124000000_intereses.sql), que revisan los permisos. Sin señal se ven; crear, cambiar, borrar, sumarse y salir
// necesitan conexión (no quedan en espera).

export type Tema = Tables<'temas'>
export type Interesado = Tables<'interesados'>

// Los temas vigentes, por nombre (los borrados no se ven: solo vuelven con "Deshacer")
export function useTemas() {
  return useQuery({
    queryKey: ['temas'],
    queryFn: async (): Promise<Tema[]> => {
      if (import.meta.env.DEV && modoMaqueta) return porNombre(temasDeMaqueta().filter((t) => t.borrado_en === null))
      const { data, error } = await supabase.from('temas').select('*').is('borrado_en', null)
      if (error) throw error
      return porNombre(data)
    },
  })
}

// A quién le interesa qué (son pocos), por orden de llegada
export function useInteresados() {
  return useQuery({
    queryKey: ['interesados'],
    queryFn: async (): Promise<Interesado[]> => {
      if (import.meta.env.DEV && modoMaqueta) return [...interesadosDeMaqueta()].sort((a, b) => a.desde.localeCompare(b.desde))
      const { data, error } = await supabase.from('interesados').select('*').order('desde')
      if (error) throw error
      return data
    },
  })
}

function porNombre(temas: Tema[]): Tema[] {
  return [...temas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

// ---------- Para leer ----------

// A quiénes les interesa un tema (sus ids, por orden de llegada). Ojo: puede incluir a quien ya no está en Puente; las
// pantallas muestran solo a los integrantes (grupo.ts).
export function interesadosDe(tema: string, interesados: Interesado[]): string[] {
  return interesados.filter((i) => i.tema === tema).map((i) => i.persona)
}

// Los temas que le interesan a una persona, por nombre
export function temasDe(persona: string, temas: Tema[], interesados: Interesado[]): Tema[] {
  return temas.filter((t) => interesados.some((i) => i.tema === t.id && i.persona === persona))
}

export function leInteresa(tema: string, persona: string, interesados: Interesado[]): boolean {
  return interesados.some((i) => i.tema === tema && i.persona === persona)
}

// Quién puede cambiar o borrar un tema: quien lo creó o quien administra
export function puedeCambiarTema(tema: Tema, yo: Persona): boolean {
  return tema.creado_por === yo.id || yo.administra
}

// El tema de un evento que todavía es solo para los de ese tema (para «Primero para los de Fintech»); null si es para
// todos (no tiene tema o ya se abrió)
export function temaPendiente(evento: Evento, temas: Tema[]): Tema | null {
  if (!soloParaTema(evento)) return null
  return temas.find((t) => t.id === evento.tema) ?? null
}

// ¿Puedes sumarte por tu cuenta, en cuanto al tema? Si todavía es solo para los de un tema, solo si te interesa o lo
// organizas (como ir y esperar en la base). Lo demás (cupos, estadía, cerrado) se revisa aparte.
export function teTocaElTema(evento: Evento, interesados: Interesado[], yo: string): boolean {
  if (!soloParaTema(evento) || evento.tema === null) return true
  return evento.organizador === yo || leInteresa(evento.tema, yo, interesados)
}

// Los eventos que se mandaron primero a un tema (abiertos o no, sin los cancelados), por hora de inicio
export function eventosDelTema(tema: string, eventos: Evento[]): Evento[] {
  return eventos.filter((e) => e.tema === tema && !e.cancelado_en).sort((a, b) => a.inicio.localeCompare(b.inicio))
}

// ---------- Para escribir ----------

// Por qué la base dijo que no (viene en "hint"); "otro" si fue otra cosa (por ejemplo, la red)
export type MotivoTema = 'nombre' | 'repetido' | 'no_esta' | 'otro'

export class ErrorDeTema extends Error {
  motivo: MotivoTema
  constructor(motivo: MotivoTema, mensaje?: string) {
    super(mensaje ?? motivo)
    this.motivo = motivo
  }
}

const MOTIVOS: readonly MotivoTema[] = ['nombre', 'repetido', 'no_esta']

function motivoDe(error: { hint?: string | null; message?: string }): ErrorDeTema {
  const hint = (error.hint ?? '') as MotivoTema
  return new ErrorDeTema(MOTIVOS.includes(hint) ? hint : 'otro', error.message)
}

const recargar = (...claves: string[]) => Promise.all(['temas', 'interesados', ...claves].map((clave) => consultas.invalidateQueries({ queryKey: [clave] })))
const ahora = () => new Date().toISOString()
const mismoNombre = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

// En la maqueta, las mismas reglas de nombre que la base
function revisarNombreDeMaqueta(nombre: string, salvo: string | null) {
  if (!nombre.trim()) throw new ErrorDeTema('nombre')
  if (temasDeMaqueta().some((t) => t.borrado_en === null && t.id !== salvo && mismoNombre(t.nombre, nombre))) throw new ErrorDeTema('repetido')
}

// Crear lleva un id armado aquí: si se reintenta y la base ya lo tiene, lo devuelve sin duplicarlo. Quien lo crea queda dentro.
export async function crearTema(nombre: string, deQueTrata: string | null): Promise<Tema> {
  const id = crypto.randomUUID()
  let creado: Tema
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    revisarNombreDeMaqueta(nombre, null)
    creado = { id, nombre: nombre.trim(), de_que_trata: deQueTrata?.trim() || null, creado_por: yo, creado_en: ahora(), borrado_en: null }
    cambiarTemasDeMaqueta((lista) => [...lista, creado])
    cambiarInteresadosDeMaqueta((lista) => [...lista, { tema: id, persona: yo, desde: ahora() }])
  } else {
    const { data, error } = await supabase.rpc('crear_tema', { id, nombre, ...(deQueTrata?.trim() ? { de_que_trata: deQueTrata } : {}) })
    if (error) throw motivoDe(error)
    creado = data
  }
  await recargar()
  return creado
}

export async function cambiarTema(id: string, nombre: string, deQueTrata: string | null): Promise<Tema> {
  let cambiado: Tema
  if (import.meta.env.DEV && modoMaqueta) {
    const antes = temasDeMaqueta().find((t) => t.id === id && t.borrado_en === null)
    if (!antes) throw new ErrorDeTema('no_esta')
    revisarNombreDeMaqueta(nombre, id)
    cambiado = { ...antes, nombre: nombre.trim(), de_que_trata: deQueTrata?.trim() || null }
    cambiarTemasDeMaqueta((lista) => lista.map((t) => (t.id === id ? cambiado : t)))
  } else {
    const { data, error } = await supabase.rpc('cambiar_tema', { tema: id, nombre, ...(deQueTrata?.trim() ? { de_que_trata: deQueTrata } : {}) })
    if (error) throw motivoDe(error)
    cambiado = data
  }
  await recargar()
  return cambiado
}

// Borrar abre a todos los eventos que todavía eran solo para este tema. Devuelve cuántos se abrieron.
export async function borrarTema(id: string): Promise<number> {
  let abiertos: number
  if (import.meta.env.DEV && modoMaqueta) {
    const cuando = ahora()
    cambiarTemasDeMaqueta((lista) => lista.map((t) => (t.id === id && t.borrado_en === null ? { ...t, borrado_en: cuando } : t)))
    const datos = datosDeMaqueta()
    const abrir = datos.eventos.filter((e) => e.tema === id && soloParaTema(e) && !e.cancelado_en && e.fin > cuando)
    datos.eventos = datos.eventos.map((e) => (abrir.includes(e) ? { ...e, abierto_en: cuando } : e))
    abiertos = abrir.length
  } else {
    const { data, error } = await supabase.rpc('borrar_tema', { tema: id })
    if (error) throw motivoDe(error)
    abiertos = data
  }
  await recargar('eventos')
  return abiertos
}

// "Deshacer" de borrar: los eventos que abrió el borrado vuelven a ser solo para el tema (dentro del primer minuto)
export async function devolverTema(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const tema = temasDeMaqueta().find((t) => t.id === id)
    if (!tema?.borrado_en) return
    if (temasDeMaqueta().some((t) => t.borrado_en === null && t.id !== id && mismoNombre(t.nombre, tema.nombre))) throw new ErrorDeTema('repetido')
    const borrado = tema.borrado_en
    const haceUnMinuto = new Date(Date.now() - 60_000).toISOString()
    cambiarTemasDeMaqueta((lista) => lista.map((t) => (t.id === id ? { ...t, borrado_en: null } : t)))
    const datos = datosDeMaqueta()
    datos.eventos = datos.eventos.map((e) => (e.tema === id && e.abierto_en === borrado && borrado > haceUnMinuto ? { ...e, abierto_en: null } : e))
  } else {
    const { error } = await supabase.rpc('devolver_tema', { tema: id })
    if (error) throw motivoDe(error)
  }
  await recargar('eventos')
}

// «Me interesa». Repetirlo no hace nada.
export async function meInteresa(tema: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    if (!temasDeMaqueta().some((t) => t.id === tema && t.borrado_en === null)) throw new ErrorDeTema('no_esta')
    cambiarInteresadosDeMaqueta((lista) => (lista.some((i) => i.tema === tema && i.persona === yo) ? lista : [...lista, { tema, persona: yo, desde: ahora() }]))
  } else {
    const { error } = await supabase.rpc('me_interesa', { tema })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

// «Ya no me interesa». Los eventos a los que ya vas no cambian.
export async function yaNoMeInteresa(tema: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    cambiarInteresadosDeMaqueta((lista) => lista.filter((i) => !(i.tema === tema && i.persona === yo)))
  } else {
    const { error } = await supabase.rpc('ya_no_me_interesa', { tema })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

import { useQuery } from '@tanstack/react-query'
import type { Enums, Tables, TablesInsert, TablesUpdate } from './base.ts'
import { consultas, type Persona } from './consultas.ts'
import { ahora, diaEn } from './fechas.ts'
import { conNotaReunion } from './enEspera.ts'
import { cambiarContactosDeMaqueta, datosDeMaqueta, modoMaqueta, personaDeMaqueta } from './maqueta.ts'
import { asegurarSesion, conPendientes, escribir, registrarEscritura } from './sinSenal.ts'
import { supabase } from './supabase.ts'

// Agenda: eventos, quiénes van (y la lista de espera), tus ratos ocupados y las notas de reunión.

export type Evento = Tables<'eventos'>
export type Asistente = Tables<'asistentes'>
export type Ocupado = Tables<'ocupados'>
export type NotaReunion = Tables<'notas_reunion'>
export type TipoEvento = Enums<'tipo_evento'>
export type ModoEvento = Enums<'modo_evento'>

// Por qué no se pudo ir a un evento
export type Motivo = 'lleno' | 'no_estas' | 'cerrado' | 'paso' | 'otro'
export class ErrorDeEvento extends Error {
  readonly motivo: Motivo
  constructor(motivo: Motivo) {
    super(motivo)
    this.motivo = motivo
  }
}

type Maqueta = ReturnType<typeof datosDeMaqueta>

// La maqueta se nombra con su clave y se lee dentro de la condición: así no llega a la app publicada
function consulta<K extends 'eventos' | 'asistentes' | 'ocupados' | 'notasReunion'>(
  clave: string,
  buscar: () => PromiseLike<{ data: Maqueta[K] | null; error: unknown }>,
  deMaqueta: K,
) {
  return {
    queryKey: [clave],
    queryFn: async (): Promise<Maqueta[K]> => {
      if (import.meta.env.DEV && modoMaqueta) {
        const datos = datosDeMaqueta()
        // Como en la base: los eventos cancelados no se ven
        return conPendientes(clave, (deMaqueta === 'eventos' ? datos.eventos.filter((e) => !e.cancelado_en) : datos[deMaqueta]) as Maqueta[K])
      }
      const { data, error } = await buscar()
      if (error) throw error
      // Con lo escrito sin señal que todavía no sube (las notas de reunión)
      return conPendientes(clave, data ?? ([] as Maqueta[K]))
    },
  }
}

export function useEventos() {
  return useQuery(consulta('eventos', () => supabase.from('eventos').select('*').is('cancelado_en', null).order('inicio'), 'eventos'))
}
export function useAsistentes() {
  return useQuery(consulta('asistentes', () => supabase.from('asistentes').select('*').order('desde'), 'asistentes'))
}
// Solo los tuyos: los de los demás cuentan para la disponibilidad, pero no se ven
export function useOcupados() {
  return useQuery(consulta('ocupados', () => supabase.from('ocupados').select('*').order('inicio'), 'ocupados'))
}
export function useNotasReunion() {
  return useQuery(consulta('notas_reunion', () => supabase.from('notas_reunion').select('*'), 'notasReunion'))
}

// Quiénes van y quiénes esperan, en orden de llegada
export function asistentesDe(evento: string, asistentes: Asistente[]): { van: Asistente[]; espera: Asistente[] } {
  const del = asistentes.filter((a) => a.evento === evento).sort((a, b) => a.desde.localeCompare(b.desde))
  return { van: del.filter((a) => a.estado === 'va'), espera: del.filter((a) => a.estado === 'espera') }
}

// Tu lugar en un evento: vas, esperas (en qué puesto) o nada
export function miLugar(evento: string, asistentes: Asistente[], yo: string): { estado: 'va' } | { estado: 'espera'; puesto: number } | null {
  const { van, espera } = asistentesDe(evento, asistentes)
  if (van.some((a) => a.persona === yo)) return { estado: 'va' }
  const puesto = espera.findIndex((a) => a.persona === yo)
  return puesto >= 0 ? { estado: 'espera', puesto: puesto + 1 } : null
}

// "Cómo llegar": el lugar en Google Maps
export function enlaceMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
}

// ¿Estás allá el día del evento? (el día en California, dentro de tu estadía)
export function estaAllaEse(persona: Pick<Persona, 'llega' | 'vuelve'>, inicio: string): boolean {
  const dia = diaEn(inicio)
  return Boolean(persona.llega && persona.vuelve && persona.llega <= dia && dia <= persona.vuelve)
}

const recargar = (...claves: string[]) => Promise.all(claves.map((clave) => consultas.invalidateQueries({ queryKey: [clave] })))

// ---------- Ir, esperar y dejar de ir: un solo paso en la base ----------
function motivoDe(error: { hint?: string | null } | null): Motivo {
  const hint = error?.hint
  return hint === 'lleno' || hint === 'no_estas' || hint === 'cerrado' || hint === 'paso' ? hint : 'otro'
}

export async function ir(evento: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    const yo = personaDeMaqueta()
    const e = datos.eventos.find((x) => x.id === evento)
    if (!e) throw new ErrorDeEvento('otro')
    if (!estaAllaEse(yo, e.inicio)) throw new ErrorDeEvento('no_estas')
    if (e.modo === 'cerrado') throw new ErrorDeEvento('cerrado')
    const { van } = asistentesDe(evento, datos.asistentes)
    if (e.modo === 'con_cupo' && e.cupos !== null && van.length >= e.cupos && !van.some((a) => a.persona === yo.id)) throw new ErrorDeEvento('lleno')
    datos.asistentes = [...datos.asistentes.filter((a) => !(a.evento === evento && a.persona === yo.id)), { evento, persona: yo.id, estado: 'va', desde: ahora() }]
  } else {
    const { error } = await supabase.rpc('ir', { evento })
    if (error) throw new ErrorDeEvento(motivoDe(error))
  }
  await recargar('asistentes')
}

// Devuelve tu puesto en la lista de espera
export async function esperar(evento: string): Promise<number> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    const yo = personaDeMaqueta().id
    if (!datos.asistentes.some((a) => a.evento === evento && a.persona === yo)) datos.asistentes = [...datos.asistentes, { evento, persona: yo, estado: 'espera', desde: ahora() }]
    await recargar('asistentes')
    return asistentesDe(evento, datos.asistentes).espera.findIndex((a) => a.persona === yo) + 1
  }
  const { data, error } = await supabase.rpc('esperar', { evento })
  if (error) throw new ErrorDeEvento(motivoDe(error))
  await recargar('asistentes')
  return data
}

// En la maqueta, como en la base: los cupos libres los toma la lista de espera, por orden de llegada
function llenarCuposDeMaqueta(evento: string) {
  // La condición va aquí mismo: así la maqueta no llega a la app publicada
  if (!(import.meta.env.DEV && modoMaqueta)) return
  const datos = datosDeMaqueta()
  const e = datos.eventos.find((x) => x.id === evento)
  if (!e) return
  const { van, espera } = asistentesDe(evento, datos.asistentes)
  if (e.modo === 'cerrado') {
    datos.asistentes = datos.asistentes.filter((a) => !espera.includes(a))
    return
  }
  const entran = e.modo === 'para_todos' ? espera : espera.slice(0, Math.max(0, (e.cupos ?? 0) - van.length))
  datos.asistentes = datos.asistentes.map((a) => (entran.includes(a) ? { ...a, estado: 'va', desde: ahora() } : a))
}

// Si sueltas un cupo, entra el primero de la lista de espera
export async function noIr(evento: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    const yo = personaDeMaqueta().id
    datos.asistentes = datos.asistentes.filter((a) => !(a.evento === evento && a.persona === yo))
    llenarCuposDeMaqueta(evento)
  } else {
    const { error } = await supabase.rpc('no_ir', { evento })
    if (error) throw error
  }
  await recargar('asistentes')
}

// Quien organiza suma o saca gente a mano
export async function sumarAEvento(evento: string, persona: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    datos.asistentes = [...datos.asistentes.filter((a) => !(a.evento === evento && a.persona === persona)), { evento, persona, estado: 'va', desde: ahora() }]
  } else {
    const { error } = await supabase.rpc('sumar_a_evento', { evento, persona })
    if (error) throw error
  }
  await recargar('asistentes')
}

export async function sacarDeEvento(evento: string, persona: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    datos.asistentes = datos.asistentes.filter((a) => !(a.evento === evento && a.persona === persona))
    llenarCuposDeMaqueta(evento)
  } else {
    const { error } = await supabase.rpc('sacar_de_evento', { evento, persona })
    if (error) throw error
  }
  await recargar('asistentes')
}

// ---------- Crear, cambiar y deshacer eventos ----------
// Quien crea el evento lo organiza y va; en uno cerrado, se suman los elegidos
export async function crearEvento(yo: string, nuevo: Omit<TablesInsert<'eventos'>, 'organizador' | 'creado_por'>, sumados: string[] = []): Promise<Evento> {
  let creado: Evento
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    creado = { id: `evento-${Date.now()}`, tipo: 'otro', lugar: null, direccion: null, modo: 'para_todos', cupos: null, notas: null, contacto: null, google_id: null, desde_google: false, cancelado_en: null, ...nuevo, organizador: yo, creado_por: yo, creado_en: ahora(), cambiado_en: ahora() }
    datos.eventos = [...datos.eventos, creado].sort((a, b) => a.inicio.localeCompare(b.inicio))
    datos.asistentes = [...datos.asistentes, { evento: creado.id, persona: yo, estado: 'va', desde: ahora() }]
  } else {
    const { data, error } = await supabase.from('eventos').insert({ ...nuevo, organizador: yo, creado_por: yo }).select('*').single()
    if (error) throw error
    creado = data
  }
  for (const persona of sumados) await sumarAEvento(creado.id, persona)
  await recargar('eventos', 'asistentes')
  return creado
}

export async function cambiarEvento(id: string, cambios: TablesUpdate<'eventos'>): Promise<Evento> {
  let cambiado: Evento
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    const antes = datos.eventos.find((e) => e.id === id)
    if (!antes) throw new Error('No existe ese evento')
    cambiado = { ...antes, ...cambios, cambiado_en: ahora() }
    datos.eventos = datos.eventos.map((e) => (e.id === id ? cambiado : e))
    llenarCuposDeMaqueta(id)
    // Como en la base: cancelar una reunión que salió de un contacto lo devuelve a "Respondió"; deshacer, a "Reunión agendada"
    const contacto = antes.contacto
    if (contacto && Boolean(antes.cancelado_en) !== Boolean(cambiado.cancelado_en)) {
      const hay = Date.parse(ahora())
      const otra = datos.eventos.some((e) => e.id !== id && e.contacto === contacto && !e.cancelado_en && Date.parse(e.fin) >= hay)
      cambiarContactosDeMaqueta((lista) =>
        lista.map((c) => {
          if (c.id !== contacto) return c
          if (cambiado.cancelado_en) return c.etapa === 'reunion_agendada' && !otra ? { ...c, etapa: 'respondio', etapa_en: ahora() } : c
          return c.etapa === 'respondio' ? { ...c, etapa: 'reunion_agendada', etapa_en: antes.creado_en } : c
        }),
      )
    }
  } else {
    const { data, error } = await supabase.from('eventos').update(cambios).eq('id', id).select('*').single()
    if (error) throw error
    cambiado = data
  }
  // Cambiar el modo o los cupos mueve la lista de espera; cancelar o deshacer mueve el contacto de la reunión
  await recargar('eventos', 'asistentes', ...('cancelado_en' in cambios ? ['contactos'] : []))
  return cambiado
}

// Solo para deshacer un evento recién creado; lo demás se cancela
export async function borrarEvento(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    datos.eventos = datos.eventos.filter((e) => e.id !== id)
    datos.asistentes = datos.asistentes.filter((a) => a.evento !== id)
  } else {
    const { error } = await supabase.from('eventos').delete().eq('id', id)
    if (error) throw error
  }
  await recargar('eventos', 'asistentes')
}

export function cancelarEvento(id: string): Promise<Evento> {
  return cambiarEvento(id, { cancelado_en: ahora() })
}

// Cuántos están allá ese día y cuántos tienen libre esa hora (Puente informa, no sugiere)
export async function libres(desde: string, hasta: string): Promise<{ alla: number; libres: number }> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    const alla = datos.personas.filter((p) => !p.sacada_en && estaAllaEse(p, desde))
    const ocupada = (persona: string) =>
      datos.asistentes.some((a) => a.persona === persona && a.estado === 'va' && datos.eventos.some((e) => e.id === a.evento && !e.cancelado_en && e.inicio < hasta && e.fin > desde)) ||
      datos.ocupados.some((o) => o.persona === persona && o.inicio < hasta && o.fin > desde)
    return { alla: alla.length, libres: alla.filter((p) => !ocupada(p.id)).length }
  }
  const { data, error } = await supabase.rpc('libres', { desde, hasta })
  if (error) throw error
  return data[0] ?? { alla: 0, libres: 0 }
}

// ---------- Ratos ocupados (solo en Puente) ----------
export async function marcarOcupado(rato: Omit<TablesInsert<'ocupados'>, 'persona'>): Promise<Ocupado> {
  let creado: Ocupado
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    creado = { id: `ocupado-${Date.now()}`, ...rato, persona: personaDeMaqueta().id }
    datos.ocupados = [...datos.ocupados, creado]
  } else {
    const { data, error } = await supabase.from('ocupados').insert(rato).select('*').single()
    if (error) throw error
    creado = data
  }
  await recargar('ocupados')
  return creado
}

export async function borrarOcupado(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const datos = datosDeMaqueta()
    datos.ocupados = datos.ocupados.filter((o) => o.id !== id)
  } else {
    const { error } = await supabase.from('ocupados').delete().eq('id', id)
    if (error) throw error
  }
  await recargar('ocupados')
}

// ---------- Notas de reunión: qué aprendiste y qué sigue (una por persona y evento) ----------
// Se escriben sin señal: quedan en espera y suben después. Repetir deja lo mismo (cambia la tuya o la crea).
registrarEscritura<NotaReunion, void>('notaReunion', {
  hacer: async (nota) => {
    if (import.meta.env.DEV && modoMaqueta) {
      const datos = datosDeMaqueta()
      datos.notasReunion = conNotaReunion(datos.notasReunion, nota)
      return
    }
    await asegurarSesion()
    const { evento, autor, aprendi, sigue, escrita_en } = nota
    const cambiar = async () => {
      const { data, error } = await supabase.from('notas_reunion').update({ aprendi, sigue, escrita_en }).eq('evento', evento).eq('autor', autor).select('evento')
      if (error) throw error
      return data.length > 0
    }
    // Primero se cambia la tuya; si no había, se crea (y si justo la creó otro intento, se cambia)
    if (await cambiar()) return
    const creada = await supabase.from('notas_reunion').insert(nota)
    if (creada.error?.code === '23505') await cambiar()
    else if (creada.error) throw creada.error
  },
  sobre: { notas_reunion: (lista: NotaReunion[], nota) => conNotaReunion(lista, nota) },
  id: (nota) => `reunion:${nota.evento}`,
  recargar: ['notas_reunion'],
})

export function guardarNotaReunion(yo: string, evento: string, nota: { aprendi: string | null; sigue: string | null }): Promise<void> {
  return escribir<NotaReunion, void>('notaReunion', { evento, autor: yo, ...nota, escrita_en: ahora() }, undefined)
}

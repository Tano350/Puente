import { useQuery } from '@tanstack/react-query'
import type { Enums, Tables, TablesInsert, TablesUpdate } from './base.ts'
import { consultas, type Persona } from './consultas.ts'
import { conNota, sinNota } from './enEspera.ts'
import { cambiarContactosDeMaqueta, cambiarNotasDeMaqueta, contactosDeMaqueta, modoMaqueta, notasDeMaqueta, personaDeMaqueta } from './maqueta.ts'
import { asegurarSesion, conPendientes, escribir, miId, registrarEscritura, soltarPendiente } from './sinSenal.ts'
import { supabase } from './supabase.ts'

// Contactos del viaje y sus notas. Todos ven todo, salvo lo personal, que ve solo quien lo creó.
// Las notas se escriben sin señal (quedan en espera y suben después); cambiar contactos necesita conexión.

export type Contacto = Tables<'contactos'>
export type Nota = Tables<'notas'>
export type Etapa = Enums<'etapa'>
export type Canal = Enums<'canal'>

// Las cinco etapas de la línea, en orden; "descartado" va aparte
export const ETAPAS = ['por_contactar', 'contactado', 'respondio', 'reunion_agendada', 'reunion_hecha'] as const satisfies readonly Etapa[]

export function useContactos() {
  return useQuery({
    queryKey: ['contactos'],
    queryFn: async (): Promise<Contacto[]> => {
      if (import.meta.env.DEV && modoMaqueta) return contactosDeMaqueta()
      const { data, error } = await supabase.from('contactos').select('*').order('nombre')
      if (error) throw error
      return data
    },
  })
}

// Todas las notas que puedes ver, de todos los contactos (son pocas)
export function useNotas() {
  return useQuery({
    queryKey: ['notas'],
    queryFn: async (): Promise<Nota[]> => {
      if (import.meta.env.DEV && modoMaqueta) return conPendientes('notas', notasDeMaqueta())
      const { data, error } = await supabase.from('notas').select('*').order('creada_en')
      if (error) throw error
      return conPendientes('notas', data)
    },
  })
}

// Quién puede cambiar un contacto: quien lo creó, su responsable y quien administra
export function puedeCambiar(contacto: Contacto, yo: Persona): boolean {
  return contacto.creado_por === yo.id || contacto.responsable === yo.id || yo.administra
}

// Pasar a "Reunión agendada" desde antes es agendar la reunión: abre Crear evento con el contacto
export function seAgenda(desde: Etapa, hacia: Etapa): boolean {
  return hacia === 'reunion_agendada' && ETAPAS.findIndex((e) => e === desde) < ETAPAS.indexOf('reunion_agendada')
}

const recargar = (clave: 'contactos' | 'notas') => consultas.invalidateQueries({ queryKey: [clave] })
const ahora = () => new Date().toISOString()

// Todo contacto nuevo parte en "Por contactar"; la primera nota es opcional
export async function agregarContacto(nuevo: TablesInsert<'contactos'>, primeraNota?: { texto: string; personal: boolean }): Promise<Contacto> {
  let creado: Contacto
  // Solo en desarrollo, con ?maqueta: se hace lo mismo que haría la base
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    creado = { id: `nuevo-${Date.now()}`, organizacion: null, canal: null, dato: null, personal: false, ...nuevo, etapa: 'por_contactar', etapa_en: ahora(), creado_por: yo, creado_en: ahora(), asignado_por: nuevo.responsable !== yo ? yo : null }
    cambiarContactosDeMaqueta((lista) => [...lista, creado])
  } else {
    const { data, error } = await supabase.from('contactos').insert(nuevo).select('*').single()
    if (error) throw error
    creado = data
  }
  // El contacto ya quedó: si la nota falla no se reporta error, para que reintentar no lo duplique
  if (primeraNota?.texto.trim()) await agregarNota({ contacto: creado.id, texto: primeraNota.texto.trim(), personal: primeraNota.personal }).catch(() => undefined)
  await recargar('contactos')
  return creado
}

// Para deshacer una etapa, manda también la fecha anterior (etapa_en); si no, la base pone la hora actual
export async function cambiarContacto(id: string, cambios: TablesUpdate<'contactos'>): Promise<Contacto> {
  let cambiado: Contacto
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    const antes = contactosDeMaqueta().find((c) => c.id === id)
    if (!antes) throw new Error('No existe ese contacto')
    cambiado = { ...antes, ...cambios }
    if (cambios.etapa && cambios.etapa !== antes.etapa && !cambios.etapa_en) cambiado.etapa_en = ahora()
    if (cambios.responsable && cambios.responsable !== antes.responsable) cambiado.asignado_por = cambios.responsable !== yo ? yo : null
    cambiarContactosDeMaqueta((lista) => lista.map((c) => (c.id === id ? cambiado : c)))
  } else {
    const { data, error } = await supabase.from('contactos').update(cambios).eq('id', id).select('*').single()
    if (error) throw error
    cambiado = data
  }
  await recargar('contactos')
  return cambiado
}

// Solo para deshacer un contacto recién agregado; lo demás se descarta
export async function borrarContacto(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarContactosDeMaqueta((lista) => lista.filter((c) => c.id !== id))
    cambiarNotasDeMaqueta((lista) => lista.filter((n) => n.contacto !== id))
  } else {
    const { error } = await supabase.from('contactos').delete().eq('id', id)
    if (error) throw error
  }
  await Promise.all([recargar('contactos'), recargar('notas')])
}

// Una nota lleva un id creado aquí: si al reintentar la base ya la tiene (23505), cuenta como hecha
registrarEscritura<{ nota: Nota }, Nota>('agregarNota', {
  hacer: async ({ nota }) => {
    if (import.meta.env.DEV && modoMaqueta) {
      if (!notasDeMaqueta().some((n) => n.id === nota.id)) cambiarNotasDeMaqueta((lista) => [...lista, nota])
      return nota
    }
    await asegurarSesion()
    const { id, contacto, texto, personal, creada_en } = nota
    const { data, error } = await supabase.from('notas').insert({ id, contacto, texto, personal, creada_en }).select('*').single()
    if (!error) return data
    if (error.code === '23505') return nota
    throw error
  },
  sobre: { notas: (lista: Nota[], { nota }) => conNota(lista, nota) },
  id: ({ nota }) => nota.id,
  recargar: ['notas'],
})

// Sin señal devuelve al tiro la nota como se verá; sube cuando vuelva la señal
export function agregarNota(nueva: TablesInsert<'notas'>): Promise<Nota> {
  const nota: Nota = {
    id: nueva.id ?? crypto.randomUUID(),
    contacto: nueva.contacto,
    texto: nueva.texto,
    personal: nueva.personal ?? false,
    autor: miId(),
    creada_en: nueva.creada_en ?? ahora(),
  }
  return escribir<{ nota: Nota }, Nota>('agregarNota', { nota }, nota)
}

export async function borrarNota(id: string): Promise<void> {
  // Si todavía no subía (Deshacer sin señal), basta con sacarla de la espera
  if (soltarPendiente<{ nota: Nota }>('agregarNota', (v) => v.nota.id === id)) {
    consultas.setQueryData<Nota[]>(['notas'], (lista) => lista && sinNota(lista, id))
    return
  }
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarNotasDeMaqueta((lista) => lista.filter((n) => n.id !== id))
  } else {
    const { error } = await supabase.from('notas').delete().eq('id', id)
    if (error) throw error
  }
  await recargar('notas')
}

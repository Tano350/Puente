import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { consultas, type Persona } from './consultas.ts'
import { conMarca, esErrorDeRed, type Marca } from './enEspera.ts'
import type { Asignado, Tarea } from './estadoTareas.ts'
import { asignadosDeMaqueta, cambiarAsignadosDeMaqueta, cambiarTareasDeMaqueta, modoMaqueta, personaDeMaqueta, tareasDeMaqueta } from './maqueta.ts'
import { asegurarSesion, conPendientes, escribir, miId, registrarEscritura, useSinSubir } from './sinSenal.ts'
import { supabase } from './supabase.ts'

// Tareas del grupo. Todos ven todo, salvo las personales de otro. Todo cambio pasa por funciones de la base
// (20261110000000_tareas.sql), que revisan los permisos. Sin señal se ven, y marcar las tuyas queda en espera y sube
// sola al volver la señal (como la rendición); crear, cambiar, borrar, tomar y soltar necesitan conexión.

export type { Asignado, Tarea } from './estadoTareas.ts'

export function useTareas() {
  return useQuery({
    queryKey: ['tareas'],
    queryFn: async (): Promise<Tarea[]> => {
      if (import.meta.env.DEV && modoMaqueta) return tareasDeMaqueta().filter((t) => t.borrada_en === null)
      const { data, error } = await supabase.from('tareas').select('*').is('borrada_en', null).order('para', { nullsFirst: false }).order('creada_en')
      if (error) throw error
      return data
    },
  })
}

// Los asignados de todas las tareas que puedes ver (son pocos), con lo marcado sin señal encima
export function useAsignados() {
  return useQuery({
    queryKey: ['asignados'],
    queryFn: async (): Promise<Asignado[]> => {
      if (import.meta.env.DEV && modoMaqueta) return conPendientes('asignados', asignadosDeMaqueta())
      const { data, error } = await supabase.from('asignados').select('*')
      if (error) throw error
      return conPendientes('asignados', data)
    },
  })
}

// Quién puede cambiar o borrar: quien la creó o quien administra; una personal, solo quien la creó
export function puedeCambiarTarea(tarea: Tarea, yo: Persona): boolean {
  return tarea.personal ? tarea.creada_por === yo.id : tarea.creada_por === yo.id || yo.administra
}

// Por qué la base dijo que no (viene en "hint"); "otro" si fue otra cosa (por ejemplo, la red)
export type MotivoTarea = 'titulo' | 'persona' | 'no_esta' | 'no_asignado' | 'tomada' | 'no_tomada' | 'otro'

export class ErrorDeTarea extends Error {
  motivo: MotivoTarea
  constructor(motivo: MotivoTarea, mensaje?: string) {
    super(mensaje ?? motivo)
    this.motivo = motivo
  }
}

const MOTIVOS: readonly MotivoTarea[] = ['titulo', 'persona', 'no_esta', 'no_asignado', 'tomada', 'no_tomada']

function motivoDe(error: { hint?: string | null; message?: string }): ErrorDeTarea {
  const hint = (error.hint ?? '') as MotivoTarea
  return new ErrorDeTarea(MOTIVOS.includes(hint) ? hint : 'otro', error.message)
}

const recargar = () => Promise.all([consultas.invalidateQueries({ queryKey: ['tareas'] }), consultas.invalidateQueries({ queryKey: ['asignados'] })])
const ahora = () => new Date().toISOString()

export type DatosTarea = {
  titulo: string
  notas: string | null
  // Día de California (AAAA-MM-DD) o null si no tiene fecha
  para: string | null
  // Solo cuenta con dos personas o más
  cadaUno: boolean
  personal: boolean
  // Ids de las personas; vacío = sin asignar. Si es personal, la base la deja solo tuya.
  personas: string[]
}

// Crear lleva un id armado aquí: si se reintenta y la base ya la tiene, la devuelve sin duplicarla
export async function crearTarea(datos: DatosTarea): Promise<Tarea> {
  const id = crypto.randomUUID()
  let creada: Tarea
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    if (!datos.titulo.trim()) throw new ErrorDeTarea('titulo')
    const gente = datos.personal ? [yo] : [...new Set(datos.personas)]
    creada = { id, titulo: datos.titulo.trim(), notas: datos.notas?.trim() || null, para: datos.para, cada_uno: datos.cadaUno && !datos.personal && gente.length >= 2, personal: datos.personal, creada_por: yo, creada_en: ahora(), borrada_en: null }
    cambiarTareasDeMaqueta((lista) => [...lista, creada])
    cambiarAsignadosDeMaqueta((lista) => [...lista, ...gente.map((persona) => ({ tarea: id, persona, tomada: false, hecha_en: null, asignado_en: ahora() }))])
  } else {
    const { data, error } = await supabase.rpc('crear_tarea', {
      id,
      titulo: datos.titulo,
      cada_uno: datos.cadaUno,
      personal: datos.personal,
      personas: datos.personas,
      ...(datos.notas?.trim() ? { notas: datos.notas } : {}),
      ...(datos.para ? { para: datos.para } : {}),
    })
    if (error) throw motivoDe(error)
    creada = data
  }
  await recargar()
  return creada
}

// Cambiar manda todo de nuevo (título, notas, fecha, cómo y para quién); quien sigue asignado conserva su marca
export async function cambiarTarea(id: string, datos: DatosTarea): Promise<Tarea> {
  let cambiada: Tarea
  if (import.meta.env.DEV && modoMaqueta) {
    const antes = tareasDeMaqueta().find((t) => t.id === id && t.borrada_en === null)
    if (!antes) throw new ErrorDeTarea('no_esta')
    if (!datos.titulo.trim()) throw new ErrorDeTarea('titulo')
    const gente = datos.personal ? [antes.creada_por] : [...new Set(datos.personas)]
    cambiada = { ...antes, titulo: datos.titulo.trim(), notas: datos.notas?.trim() || null, para: datos.para, cada_uno: datos.cadaUno && !datos.personal && gente.length >= 2, personal: datos.personal }
    cambiarTareasDeMaqueta((lista) => lista.map((t) => (t.id === id ? cambiada : t)))
    cambiarAsignadosDeMaqueta((lista) => {
      const quedan = lista.filter((a) => a.tarea !== id || gente.includes(a.persona))
      const nuevos = gente.filter((p) => !quedan.some((a) => a.tarea === id && a.persona === p)).map((persona) => ({ tarea: id, persona, tomada: false, hecha_en: null, asignado_en: ahora() }))
      return [...quedan, ...nuevos]
    })
  } else {
    const { data, error } = await supabase.rpc('cambiar_tarea', {
      tarea: id,
      titulo: datos.titulo,
      cada_uno: datos.cadaUno,
      personal: datos.personal,
      personas: datos.personas,
      ...(datos.notas?.trim() ? { notas: datos.notas } : {}),
      ...(datos.para ? { para: datos.para } : {}),
    })
    if (error) throw motivoDe(error)
    cambiada = data
  }
  await recargar()
  return cambiada
}

// Borrar deja la tarea marcada como borrada; devolver la trae de vuelta (para "Deshacer")
export async function borrarTarea(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarTareasDeMaqueta((lista) => lista.map((t) => (t.id === id ? { ...t, borrada_en: ahora() } : t)))
  } else {
    const { error } = await supabase.rpc('borrar_tarea', { tarea: id })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

export async function devolverTarea(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarTareasDeMaqueta((lista) => lista.map((t) => (t.id === id ? { ...t, borrada_en: null } : t)))
  } else {
    const { error } = await supabase.rpc('devolver_tarea', { tarea: id })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

// "Me la tomo": si otra persona se la tomó antes, falla con motivo "tomada"
export async function tomarTarea(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    if (asignadosDeMaqueta().some((a) => a.tarea === id)) throw new ErrorDeTarea('tomada')
    cambiarAsignadosDeMaqueta((lista) => [...lista, { tarea: id, persona: yo, tomada: true, hecha_en: null, asignado_en: ahora() }])
  } else {
    const { error } = await supabase.rpc('tomar_tarea', { tarea: id })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

export async function soltarTarea(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    const yo = personaDeMaqueta().id
    cambiarAsignadosDeMaqueta((lista) => lista.filter((a) => !(a.tarea === id && a.persona === yo && a.tomada)))
  } else {
    const { error } = await supabase.rpc('soltar_tarea', { tarea: id })
    if (error) throw motivoDe(error)
  }
  await recargar()
}

// Marcar o desmarcar funciona sin señal. Lleva el estado al que queda (no un "cambiar"), así subirlo dos veces deja
// lo mismo. Lo que se ve antes de subir sigue las reglas de la base (conMarca, en enEspera.ts).
registrarEscritura<Marca, 'listo' | 'enEspera'>('marcarTarea', {
  hacer: async (marca) => {
    if (import.meta.env.DEV && modoMaqueta) {
      const tarea = tareasDeMaqueta().find((t) => t.id === marca.tarea && t.borrada_en === null)
      if (!tarea) throw new ErrorDeTarea('no_esta')
      if (!asignadosDeMaqueta().some((a) => a.tarea === marca.tarea && a.persona === marca.persona)) throw new ErrorDeTarea('no_asignado')
      cambiarAsignadosDeMaqueta((lista) => conMarca(lista, { ...marca, cadaUno: tarea.cada_uno }))
      return 'listo'
    }
    await asegurarSesion()
    const { error } = await supabase.rpc('marcar_tarea', { tarea: marca.tarea, hecha: marca.hecha })
    // Sin red se reintenta (por eso va tal cual); si la base dice que no, va con su motivo
    if (error) throw esErrorDeRed(error) ? error : motivoDe(error)
    return 'listo'
  },
  sobre: { asignados: (lista: Asignado[], marca) => conMarca(lista, marca) },
  id: ({ tarea }) => `tarea:${tarea}`,
  recargar: ['asignados', 'tareas'],
})

// Devuelve "enEspera" si quedó guardada para subir después (sin señal); si la base la rechaza al tiro, falla con
// ErrorDeTarea ("no_esta", "no_asignado")
export function marcarTarea(id: string, hecha: boolean): Promise<'listo' | 'enEspera'> {
  const cadaUno = consultas.getQueryData<Tarea[]>(['tareas'])?.find((t) => t.id === id)?.cada_uno ?? false
  return escribir<Marca, 'listo' | 'enEspera'>('marcarTarea', { tarea: id, hecha, persona: miId(), cadaUno, en: ahora() }, 'enEspera')
}

// Los ids de las tareas con una marca tuya que todavía no sube ("Sin subir")
export function useTareasSinSubir(): ReadonlySet<string> {
  const sinSubir = useSinSubir()
  return useMemo(() => new Set([...sinSubir].filter((clave) => clave.startsWith('tarea:')).map((clave) => clave.slice('tarea:'.length))), [sinSubir])
}

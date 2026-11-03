import { useQuery } from '@tanstack/react-query'
import type { Tables } from './base.ts'
import { consultas } from './consultas.ts'
import { calendariosDeMaqueta, cambiarCalendariosDeMaqueta, cambiarSincronizacionDeMaqueta, modoMaqueta, sincronizacionDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Google Calendar: Puente pone cada evento en el calendario "The Bridge" de cada uno que va y mira esos calendarios
// solo para saber quién está ocupado. Lo hace con la cuenta de Google de quien administra, que ya los ve:
// la conecta una vez y la base guarda el acceso. La base mira cada 10 minutos qué calendarios del viaje hay en esa
// cuenta; quien administra dice de quién es cada uno y enciende la sincronización. Apagada, no toca ningún calendario.

// Un calendario del viaje que se ve en la cuenta de quien administra; "permiso" es el de Google (owner, writer, reader…)
export type Calendario = Tables<'calendarios'>
export type Sincronizacion = Tables<'sincronizacion'>

const PIDIENDO = 'puente.conectandoCalendario'
const PERMISOS = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
let conectadoEnMaqueta = false

export function useCalendarioConectado(administra: boolean) {
  return useQuery({
    queryKey: ['calendario'],
    enabled: administra,
    queryFn: async (): Promise<boolean> => {
      if (import.meta.env.DEV && modoMaqueta) return conectadoEnMaqueta
      const { data, error } = await supabase.rpc('calendario_conectado')
      if (error) throw error
      return data
    },
  })
}

// Lleva a Google a pedir el permiso de calendario; Google vuelve a la dirección "volverA"
export async function conectarCalendario(volverA: string): Promise<void> {
  try {
    localStorage.setItem(PIDIENDO, '1')
  } catch {
    // Sin almacenamiento no se puede saber al volver que se estaba conectando
  }
  if (import.meta.env.DEV && modoMaqueta) {
    window.location.assign(`${window.location.pathname}${window.location.search}`)
    return
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${volverA}`, scopes: PERMISOS, queryParams: { access_type: 'offline', prompt: 'consent' } },
  })
  if (error) throw error
}

// Al volver de Google, la llave para seguir entrando a los calendarios llega una sola vez: se guarda en la base.
// Devuelve null si no se estaba conectando.
export async function guardarAccesoAlVolver(): Promise<'conectado' | 'sinPermiso' | null> {
  let pidiendo = false
  try {
    pidiendo = localStorage.getItem(PIDIENDO) === '1'
    localStorage.removeItem(PIDIENDO)
  } catch {
    return null
  }
  if (!pidiendo) return null
  if (import.meta.env.DEV && modoMaqueta) {
    conectadoEnMaqueta = true
  } else {
    const { data } = await supabase.auth.getSession()
    const llave = data.session?.provider_refresh_token
    if (!llave) return 'sinPermiso'
    const { error } = await supabase.rpc('guardar_acceso_google', { llave })
    if (error) throw error
  }
  // La consulta que partió al abrir la pantalla puede traer la respuesta de antes: se corta y queda "conectado"
  await consultas.cancelQueries({ queryKey: ['calendario'] })
  consultas.setQueryData(['calendario'], true)
  return 'conectado'
}

// Los calendarios del viaje que hay en la cuenta conectada, con de quién es cada uno
export function useCalendariosDelViaje(administra: boolean) {
  return useQuery({
    queryKey: ['calendarios'],
    enabled: administra,
    queryFn: async (): Promise<Calendario[]> => {
      if (import.meta.env.DEV && modoMaqueta) return calendariosDeMaqueta()
      const { data, error } = await supabase.rpc('calendarios_del_viaje')
      if (error) throw error
      return data
    },
  })
}

export function useSincronizacion(administra: boolean) {
  return useQuery({
    queryKey: ['sincronizacion'],
    enabled: administra,
    queryFn: async (): Promise<Sincronizacion | null> => {
      if (import.meta.env.DEV && modoMaqueta) return sincronizacionDeMaqueta()
      const { data, error } = await supabase.rpc('estado_sincronizacion')
      if (error) throw error
      return data[0] ?? null
    },
  })
}

// De quién es un calendario. Una persona tiene uno solo: si ya tenía otro, ese queda sin asignar.
export async function asignarCalendario(googleId: string, persona: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarCalendariosDeMaqueta((lista) => lista.map((c) => (c.google_id === googleId ? { ...c, persona } : c.persona === persona ? { ...c, persona: null } : c)))
  } else {
    const { error } = await supabase.rpc('asignar_calendario', { google_id: googleId, persona })
    if (error) throw error
  }
  await consultas.invalidateQueries({ queryKey: ['calendarios'] })
}

export async function cambiarSincronizacion(activa: boolean): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarSincronizacionDeMaqueta(activa)
  } else {
    const { error } = await supabase.rpc('sincronizar_calendarios', { activa })
    if (error) throw error
  }
  await consultas.invalidateQueries({ queryKey: ['sincronizacion'] })
}

// Pide a la base que mire ahora la cuenta de Google; la lista nueva llega en unos segundos
export async function buscarCalendarios(): Promise<void> {
  if (!(import.meta.env.DEV && modoMaqueta)) {
    const { error } = await supabase.rpc('buscar_calendarios')
    if (error) throw error
  }
  await new Promise((listo) => window.setTimeout(listo, 4000))
  await consultas.invalidateQueries({ queryKey: ['calendarios'] })
  await consultas.invalidateQueries({ queryKey: ['sincronizacion'] })
}

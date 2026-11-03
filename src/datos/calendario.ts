import { useQuery } from '@tanstack/react-query'
import { consultas } from './consultas.ts'
import { modoMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Google Calendar: Puente pone cada evento en el calendario "The Bridge" de cada uno que va y mira esos calendarios
// solo para saber quién está ocupado. Lo hace con la cuenta de Google de quien administra, que ya los ve:
// la conecta una vez y la base guarda el acceso (la sincronización corre en el servidor cada 10 minutos).

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

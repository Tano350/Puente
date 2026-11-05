import { QueryClient, useQuery } from '@tanstack/react-query'
import type { Tables } from './base.ts'
import { modoMaqueta, personasDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Lo traído queda guardado en el dispositivo un mes (sinSenal.ts): sin señal se ve lo último que se trajo.
// La maqueta lee sus datos de ejemplo aunque "no haya señal" (?sinsenal), para ver cómo queda.
// gcTime sin plazo: lo que ninguna pantalla mira sigue en la caché y se guarda en el dispositivo (el mes lo pone
// sinSenal.ts). Un plazo de más de ~24,8 días no sirve: desborda el temporizador del navegador y se borra al tiro.
export const consultas = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, gcTime: Infinity, networkMode: import.meta.env.DEV && modoMaqueta ? 'always' : 'online' },
  },
})

export type Persona = Tables<'personas'>

// Los invitados que ve quien entró (sin los que sacaron, salvo para quien administra)
export function usePersonas() {
  return useQuery({
    queryKey: ['personas'],
    queryFn: async (): Promise<Persona[]> => {
      if (import.meta.env.DEV && modoMaqueta) return personasDeMaqueta()
      const { data, error } = await supabase.from('personas').select('*').order('nombre', { nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

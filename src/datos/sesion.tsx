import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { TablesUpdate } from './base.ts'
import { consultas, type Persona } from './consultas.ts'
import { modoMaqueta, personaDeMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

export type { Persona }
export type CambiosDePersona = TablesUpdate<'personas'>

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'fuera' }
  | { tipo: 'noInvitado'; correo: string | null }
  | { tipo: 'dentro'; persona: Persona }

export type Sesion = Estado & {
  entrar: () => Promise<void>
  probarOtraCuenta: () => Promise<void>
  salir: () => Promise<void>
  actualizar: (cambios: CambiosDePersona) => Promise<void>
}

const GUARDADA = 'puente.persona'

// Si Supabase rechazó la cuenta (no está invitada), el motivo llega en la dirección.
// Se lee una sola vez, al cargar la app, y se limpia la dirección.
function leerRechazo(): Estado | null {
  const busqueda = new URLSearchParams(window.location.search)
  const ancla = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const descripcion = busqueda.get('error_description') ?? ancla.get('error_description')
  if (!descripcion) return null
  window.history.replaceState(null, '', window.location.pathname)
  if (!descripcion.includes('no está invitada')) return { tipo: 'fuera' }
  return { tipo: 'noInvitado', correo: descripcion.match(/(\S+@\S+)/)?.[1] ?? null }
}
const rechazo = leerRechazo()

function personaGuardada(usuario: string): Persona | null {
  try {
    const guardada = JSON.parse(localStorage.getItem(GUARDADA) ?? 'null') as Persona | null
    return guardada?.usuario === usuario ? guardada : null
  } catch {
    return null
  }
}

function guardarPersona(persona: Persona | null) {
  try {
    if (persona) localStorage.setItem(GUARDADA, JSON.stringify(persona))
    else localStorage.removeItem(GUARDADA)
  } catch {
    // Sin almacenamiento la app igual funciona; solo no abre sin señal
  }
}

const Contexto = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    import.meta.env.DEV && modoMaqueta ? { tipo: 'dentro', persona: personaDeMaqueta() } : (rechazo ?? { tipo: 'cargando' }),
  )

  useEffect(() => {
    if (import.meta.env.DEV && modoMaqueta) return
    let vigente = true
    async function cargar(sesion: Session | null) {
      if (!sesion) {
        setEstado((anterior) => (anterior.tipo === 'noInvitado' ? anterior : { tipo: 'fuera' }))
        return
      }
      const { data, error } = await supabase.from('personas').select('*').eq('usuario', sesion.user.id).maybeSingle()
      if (!vigente) return
      if (error) {
        // Sin señal: se usa la última persona conocida
        const guardada = personaGuardada(sesion.user.id)
        setEstado(guardada ? { tipo: 'dentro', persona: guardada } : { tipo: 'fuera' })
        return
      }
      guardarPersona(data)
      setEstado(data ? { tipo: 'dentro', persona: data } : { tipo: 'noInvitado', correo: sesion.user.email ?? null })
    }
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      // Supabase pide no esperar otras llamadas dentro de este aviso
      setTimeout(() => void cargar(sesion), 0)
    })
    return () => {
      vigente = false
      data.subscription.unsubscribe()
    }
  }, [])

  const entrar = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/hoy`, queryParams: { prompt: 'select_account' } },
    })
  }
  const salir = async () => {
    guardarPersona(null)
    await supabase.auth.signOut()
    setEstado({ tipo: 'fuera' })
  }
  const probarOtraCuenta = async () => {
    await supabase.auth.signOut()
    await entrar()
  }
  // Guarda cambios del propio perfil y deja a todos con la versión nueva
  const actualizar = async (cambios: CambiosDePersona) => {
    if (estado.tipo !== 'dentro') return
    if (import.meta.env.DEV && modoMaqueta) {
      setEstado({ tipo: 'dentro', persona: { ...estado.persona, ...cambios } as Persona })
      return
    }
    const { data, error } = await supabase.from('personas').update(cambios).eq('id', estado.persona.id).select('*').single()
    if (error) throw error
    guardarPersona(data)
    setEstado({ tipo: 'dentro', persona: data })
    void consultas.invalidateQueries({ queryKey: ['personas'] })
  }

  return <Contexto.Provider value={{ ...estado, entrar, probarOtraCuenta, salir, actualizar }}>{children}</Contexto.Provider>
}

export function useSesion(): Sesion {
  const sesion = useContext(Contexto)
  if (!sesion) throw new Error('useSesion necesita estar dentro de SesionProvider')
  return sesion
}

import { consultas, type Persona } from './consultas.ts'
import { cambiarMaqueta, modoMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Lo que hace quien administra Puente: invitar, sacar a alguien y deshacerlo.

// La dirección que se comparte con los invitados
export const ENLACE_DE_PUENTE = 'https://puente-2027.vercel.app'

export type FalloAlInvitar = 'yaInvitado' | 'correoIncompleto' | 'otro'

export class ErrorAlInvitar extends Error {
  readonly motivo: FalloAlInvitar
  constructor(motivo: FalloAlInvitar) {
    super(motivo)
    this.motivo = motivo
  }
}

const recargar = () => consultas.invalidateQueries({ queryKey: ['personas'] })

export async function invitar(correo: string): Promise<Persona> {
  // Solo en desarrollo, con ?maqueta: los cambios quedan en las personas de ejemplo
  if (import.meta.env.DEV && modoMaqueta) {
    const limpio = correo.trim().toLowerCase()
    const nueva = { id: `nueva-${Date.now()}`, correo: limpio, usuario: null, nombre: null, foto: null, carrera: null, emprendimiento: null, emprendimiento_texto: null, objetivos: null, linkedin: null, llega: null, vuelve: null, administra: false, idioma: 'es', invitada_por: null, invitada_en: new Date().toISOString(), entro_en: null, sacada_en: null, bienvenida_en: null, avisos: {} }
    cambiarMaqueta((personas) => [...personas, nueva])
    await recargar()
    return nueva
  }
  const { data, error } = await supabase.rpc('invitar', { correo_nuevo: correo.trim() })
  if (error) throw new ErrorAlInvitar(error.code === '23505' ? 'yaInvitado' : error.code === '22023' ? 'correoIncompleto' : 'otro')
  await recargar()
  return data
}

// Sacar no borra: la persona ya no puede entrar, pero lo que anotó se queda
export async function sacar(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarMaqueta((personas) => personas.map((p) => (p.id === id ? { ...p, sacada_en: new Date().toISOString() } : p)))
  } else {
    const { error } = await supabase.rpc('sacar', { persona: id })
    if (error) throw error
  }
  await recargar()
}

export async function devolver(id: string): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) {
    cambiarMaqueta((personas) => personas.map((p) => (p.id === id ? { ...p, sacada_en: null } : p)))
  } else {
    const { error } = await supabase.rpc('devolver', { persona: id })
    if (error) throw error
  }
  await recargar()
}

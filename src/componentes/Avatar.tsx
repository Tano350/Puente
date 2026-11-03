import type { Persona } from '../datos/consultas.ts'
import estilos from './Avatar.module.css'

export function iniciales(persona: Pick<Persona, 'nombre' | 'correo'>): string {
  const partes = (persona.nombre ?? persona.correo).trim().split(/\s+/)
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2)
  return letras.toUpperCase()
}

// Foto de Google o, si no hay, las iniciales en un círculo
export function Avatar({ persona, medida }: { persona: Pick<Persona, 'nombre' | 'correo' | 'foto'>; medida: number }) {
  const tamano = { width: medida, height: medida, fontSize: Math.round(medida * 0.35) }
  if (persona.foto) {
    return <img className={estilos.avatar} style={tamano} src={persona.foto} alt="" referrerPolicy="no-referrer" />
  }
  return (
    <span className={estilos.avatar} style={tamano} aria-hidden="true">
      {iniciales(persona)}
    </span>
  )
}

import { useState } from 'react'
import { usePersonas, type Persona } from '../datos/consultas.ts'
import { coincide, integrantes } from '../datos/grupo.ts'
import { nombreCompleto } from '../datos/nombres.ts'
import { useSesion } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import { Avatar } from './Avatar.tsx'
import { Buscador } from './Buscador.tsx'
import { Hoja, TituloHoja } from './Controles.tsx'
import { Icono } from './Icono.tsx'
import estilos from './ElegirPersona.module.css'

// Elegir a una de las 14 personas, con el buscador de siempre. "Tú" va primero.
export function ElegirPersona({ abierta, titulo, elegida, onElegir, onCerrar }: { abierta: boolean; titulo: string; elegida?: string | null; onElegir: (persona: Persona) => void; onCerrar: () => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const [busqueda, setBusqueda] = useState('')
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const visibles = integrantes([yo, ...(personas ?? []).filter((p) => p.id !== yo.id)], yo.id).filter((p) => coincide(p, busqueda))
  const cerrar = () => {
    setBusqueda('')
    onCerrar()
  }
  return (
    <Hoja abierta={abierta} etiqueta={titulo} onCerrar={cerrar}>
      <TituloHoja>{titulo}</TituloHoja>
      <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscador} />
      <div className={estilos.lista}>
        {visibles.map((p) => {
          const tuyo = p.id === yo.id
          return (
            <button
              key={p.id}
              type="button"
              className={estilos.persona}
              aria-pressed={elegida === p.id}
              onClick={() => {
                setBusqueda('')
                onElegir(p)
              }}
            >
              {tuyo ? <span className={estilos.tuAvatar} aria-hidden="true">{textos.grupo.tu}</span> : <Avatar persona={p} medida={36} />}
              <span className={estilos.nombre} data-tu={tuyo}>{tuyo ? textos.grupo.tu : nombreCompleto(p)}</span>
              {elegida === p.id && <Icono nombre="check" medida={20} trazo={2.25} />}
            </button>
          )
        })}
        {visibles.length === 0 && <div className={estilos.nadie}>{textos.nadieCoincide(busqueda.trim())}</div>}
      </div>
    </Hoja>
  )
}

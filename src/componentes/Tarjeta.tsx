import type { Persona } from '../datos/consultas.ts'
import { diasEntre, estadia, rangoLargo } from '../datos/fechas.ts'
import { carreraCorta, primerNombre } from '../datos/nombres.ts'
import { Avatar } from './Avatar.tsx'
import { Icono } from './Icono.tsx'
import estilos from './Tarjeta.module.css'

function enlaceLinkedin(linkedin: string): string {
  return /^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`
}

// La tarjeta de presentación de una persona: así se ve cada uno en Puente
export function Tarjeta({ persona }: { persona: Persona }) {
  const estado = estadia(persona.llega, persona.vuelve)
  return (
    <div className={estilos.tarjeta}>
      {persona.carrera && <span className={estilos.cinta}>{carreraCorta(persona.carrera)}</span>}
      <div className={estilos.cabeza}>
        <Avatar persona={persona} medida={56} />
        <span className={estilos.quien}>
          <span className={estilos.nombre}>{persona.nombre ?? persona.correo}</span>
          {estado.tipo !== 'sinFechas' && (
            <span className={estilos.estado} data-alla={estado.tipo === 'alla'}>
              {estado.tipo === 'alla' && <span className={estilos.punto} aria-hidden="true" />}
              {estado.texto}
            </span>
          )}
        </span>
      </div>
      {persona.linkedin && (
        <div className={estilos.linkedin}>
          <span className={estilos.linkedinIcono}>
            <Icono nombre="linkedin" medida={20} />
          </span>
          <span className={estilos.linkedinTexto}>
            <span className={estilos.linkedinEtiqueta}>LinkedIn</span>
            <span>Perfil de {primerNombre(persona)}</span>
          </span>
          <a className={estilos.abrir} href={enlaceLinkedin(persona.linkedin)} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      )}
    </div>
  )
}

// Lo que acompaña a la tarjeta en el computador: emprendimiento, objetivos y estadía
export function DetallePersona({ persona }: { persona: Persona }) {
  return (
    <>
      {persona.emprendimiento && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>Emprendimiento</div>
          <div className={estilos.emprendimiento}>
            <div className={estilos.empNombre}>{persona.emprendimiento}</div>
            {persona.emprendimiento_texto && <div>{persona.emprendimiento_texto}</div>}
          </div>
        </div>
      )}
      {persona.objetivos && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>Objetivos del viaje</div>
          <div className={estilos.objetivos}>{persona.objetivos}</div>
        </div>
      )}
      {persona.llega && persona.vuelve && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>Estadía</div>
          <div className={estilos.rango}>{rangoLargo(persona.llega, persona.vuelve)}</div>
          <div className={estilos.dias}>{diasEntre(persona.llega, persona.vuelve)} días allá.</div>
        </div>
      )}
    </>
  )
}

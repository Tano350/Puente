import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ConPastilla } from '../../componentes/ConPastilla.tsx'
import { EntradaPerfil } from '../../componentes/EntradaPerfil.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './Grupo.module.css'

export type VistaGrupo = 'estadias' | 'intereses'

// «Estadías | Intereses»: cambia entre las dos vistas de Grupo. Cada vista arma el suyo: con la clave, la marca parte
// desde donde estaba y se desliza a la otra opción
export function SegmentoGrupo({ vista }: { vista: VistaGrupo }) {
  const textos = useTextos()
  const navigate = useNavigate()
  const ir = (otra: VistaGrupo) => {
    if (otra !== vista) navigate(otra === 'estadias' ? '/grupo' : '/grupo/intereses', { replace: true })
  }
  return (
    <ConPastilla role="group" aria-label={textos.intereses.grupo.queVer} className={estilos.segmento} clave="grupo-vista">
      <button type="button" aria-pressed={vista === 'estadias'} onClick={() => ir('estadias')}>
        {textos.intereses.comun.estadias}
      </button>
      <button type="button" aria-pressed={vista === 'intereses'} onClick={() => ir('intereses')}>
        {textos.intereses.comun.titulo}
      </button>
    </ConPastilla>
  )
}

// El botón «+ Nuevo» / «+ Nuevo tema»; sin conexión se ve apagado y, al tocarlo, avisa
export function BotonNuevoTema({ texto, apagado, activo = false, onClick }: { texto: string; apagado: boolean; activo?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={estilos.nuevo} aria-pressed={activo} aria-disabled={apagado} onClick={onClick}>
      <Icono nombre="mas" medida={18} trazo={2.25} />
      {texto}
    </button>
  )
}

// La cabecera de Grupo en el celular: el título con tu foto, el selector de vista y lo que quiera sumar la vista
export function CabeceraCelular({ vista, conFicha = false, nuevo, children }: { vista: VistaGrupo; conFicha?: boolean; nuevo?: ReactNode; children?: ReactNode }) {
  const textos = useTextos()
  return (
    <div className={estilos.cabecera}>
      {conFicha && (
        <div className={estilos.fichaCel}>
          <SinConexion sobrePanel />
        </div>
      )}
      <div className={estilos.cabeceraFila}>
        <h1 className={estilos.titulo}>{textos.grupo.titulo}</h1>
        <EntradaPerfil />
      </div>
      <div className={estilos.controles}>
        <SegmentoGrupo vista={vista} />
        {nuevo}
      </div>
      {children}
    </div>
  )
}

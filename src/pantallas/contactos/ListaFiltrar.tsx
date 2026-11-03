import { useId, useState } from 'react'
import { BotonPrincipal, Hoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { ETAPAS, type Etapa } from '../../datos/contactos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './ListaFiltrar.module.css'

export type Filtros = { estados: Etapa[]; responsables: string[] }

type Props = {
  filtros: Filtros
  mios: boolean
  responsables: { id: string; texto: string }[]
  cuantos: (filtros: Filtros) => number
  onAplicar: (filtros: Filtros) => void
  onCerrar: () => void
}

const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])

function Chip({ activo, texto, onClick }: { activo: boolean; texto: string; onClick: () => void }) {
  return (
    <button type="button" className={estilos.chip} aria-pressed={activo} onClick={onClick}>
      {activo && <Icono nombre="check" medida={14} trazo={2.5} />}
      {texto}
    </button>
  )
}

// Celular: la hoja de filtros. Lo elegido se aplica recién con "Ver N contactos"; con "Míos" no se filtra por responsable
export function ListaFiltrar({ filtros, mios, responsables, cuantos, onAplicar, onCerrar }: Props) {
  const textos = useTextos()
  const t = textos.contactos
  const [borrador, setBorrador] = useState(filtros)
  const idEstado = useId()
  const idResponsable = useId()
  const n = cuantos(borrador)
  return (
    <Hoja abierta etiqueta={t.lista.filtrarContactos} onCerrar={onCerrar}>
      <div className={estilos.cabeza}>
        <h2 className={estilos.titulo}>{t.lista.filtrar}</h2>
        <button type="button" className={estilos.limpiar} onClick={() => setBorrador({ estados: [], responsables: [] })}>
          {t.lista.limpiar}
        </button>
      </div>
      <div id={idEstado} className={estilos.etiqueta}>
        {t.lista.estado}
      </div>
      <div role="group" aria-labelledby={idEstado} className={estilos.chips}>
        {[...ETAPAS, 'descartado' as const].map((etapa) => (
          <Chip key={etapa} activo={borrador.estados.includes(etapa)} texto={t.etapas[etapa]} onClick={() => setBorrador({ ...borrador, estados: alternar(borrador.estados, etapa) })} />
        ))}
      </div>
      {!mios && (
        <>
          <div id={idResponsable} className={estilos.etiqueta} data-segunda="true">
            {t.responsable}
          </div>
          <div role="group" aria-labelledby={idResponsable} className={estilos.chips}>
            {responsables.map((r) => (
              <Chip key={r.id} activo={borrador.responsables.includes(r.id)} texto={r.texto} onClick={() => setBorrador({ ...borrador, responsables: alternar(borrador.responsables, r.id) })} />
            ))}
          </div>
        </>
      )}
      <div className={estilos.boton}>
        <BotonPrincipal apagado={n === 0} onClick={() => onAplicar(borrador)}>
          {t.lista.ver(n)}
        </BotonPrincipal>
      </div>
    </Hoja>
  )
}

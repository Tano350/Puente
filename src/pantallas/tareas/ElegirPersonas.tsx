import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../../componentes/Avatar.tsx'
import { Buscador } from '../../componentes/Buscador.tsx'
import { BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono, type NombreIcono } from '../../componentes/Icono.tsx'
import { usePersonas } from '../../datos/consultas.ts'
import { coincide, porNombre } from '../../datos/grupo.ts'
import { nombreCompleto } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './ElegirPersonas.module.css'

type Props = {
  // En el computador es un menú debajo de la fila "Para quién"; en el celular, una hoja desde abajo
  computador: boolean
  abierta: boolean
  // Ids de las personas marcadas; vacío = sin asignar
  elegidas: string[]
  onCambio: (ids: string[]) => void
  onCerrar: () => void
}

// "Para quién": casillas para las 14 personas, con "Sin asignar" y "Todos" arriba. Con el buscador se ven solo las
// personas que coinciden. En el computador debe ir dentro de un contenedor con position: relative, justo bajo la fila.
export function ElegirPersonas({ computador, abierta, elegidas, onCambio, onCerrar }: Props) {
  const sesion = useSesion()
  if (sesion.tipo !== 'dentro') return null
  if (computador) return <Menu abierta={abierta} yo={sesion.persona.id} elegidas={elegidas} onCambio={onCambio} onCerrar={onCerrar} />
  return <HojaPersonas abierta={abierta} yo={sesion.persona.id} elegidas={elegidas} onCambio={onCambio} onCerrar={onCerrar} />
}

type Interno = Omit<Props, 'computador'> & { yo: string }

function HojaPersonas({ abierta, yo, elegidas, onCambio, onCerrar }: Interno) {
  const textos = useTextos()
  const [busqueda, setBusqueda] = useState('')
  const cerrar = () => {
    setBusqueda('')
    onCerrar()
  }
  return (
    <Hoja abierta={abierta} etiqueta={textos.tareas.nueva.paraQuien} onCerrar={cerrar}>
      <TituloHoja>{textos.tareas.nueva.paraQuien}</TituloHoja>
      <Contenido yo={yo} elegidas={elegidas} onCambio={onCambio} busqueda={busqueda} onBusqueda={setBusqueda} onListo={cerrar} />
    </Hoja>
  )
}

// El menú del computador: se cierra con Escape y al tocar fuera (la fila que lo abre no cuenta como fuera)
function Menu({ abierta, yo, elegidas, onCambio, onCerrar }: Interno) {
  const textos = useTextos()
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierta) return
    caja.current?.querySelector('input')?.focus({ preventScroll: true })
    caja.current?.scrollIntoView({ block: 'nearest' })
    const fuera = (e: PointerEvent) => {
      const contenedor = caja.current?.parentElement
      if (e.target instanceof Node && contenedor && !contenedor.contains(e.target)) onCerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCerrar()
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [abierta, onCerrar])
  useEffect(() => {
    if (!abierta) setBusqueda('')
  }, [abierta])
  if (!abierta) return null
  return (
    <div ref={caja} role="dialog" aria-label={textos.tareas.nueva.paraQuien} className={estilos.menu}>
      <Contenido yo={yo} elegidas={elegidas} onCambio={onCambio} busqueda={busqueda} onBusqueda={setBusqueda} onListo={onCerrar} />
    </div>
  )
}

function Contenido({ yo, elegidas, onCambio, busqueda, onBusqueda, onListo }: { yo: string; elegidas: string[]; onCambio: (ids: string[]) => void; busqueda: string; onBusqueda: (texto: string) => void; onListo: () => void }) {
  const textos = useTextos()
  const t = textos.tareas.nueva
  const { data: personas } = usePersonas()
  // Quienes siguen en Puente: "Tú" primero y el resto por nombre
  const gente = useMemo(() => {
    const activas = (personas ?? []).filter((p) => !p.sacada_en)
    return [...activas.filter((p) => p.id === yo), ...activas.filter((p) => p.id !== yo).sort(porNombre)]
  }, [personas, yo])
  const buscando = busqueda.trim() !== ''
  const visibles = gente.filter((p) => coincide(p, busqueda))
  const marcadas = new Set(elegidas)
  const n = gente.filter((p) => marcadas.has(p.id)).length
  const todos = gente.length > 0 && n === gente.length

  const alternar = (id: string, si: boolean) => onCambio(si ? [...elegidas.filter((x) => x !== id), id] : elegidas.filter((x) => x !== id))

  return (
    <div className={estilos.contenido}>
      <Buscador valor={busqueda} onCambio={onBusqueda} clase={estilos.buscador} />
      <div className={estilos.lista}>
        {!buscando && (
          <>
            <Fila
              icono="mas"
              nombre={textos.tareas.comun.sinAsignar}
              nota={t.cualquieraSeLaToma}
              marcada={n === 0}
              onCambio={(si) => {
                if (si) onCambio([])
              }}
            />
            <Fila icono="grupo" nombre={t.todos} marcada={todos} onCambio={(si) => onCambio(si ? gente.map((p) => p.id) : [])} />
          </>
        )}
        {visibles.map((p) => {
          const tuyo = p.id === yo
          return (
            <Fila
              key={p.id}
              avatar={tuyo ? <span className={estilos.circulo}><Icono nombre="perfil" medida={17} /></span> : <Avatar persona={p} medida={32} />}
              nombre={tuyo ? textos.tareas.comun.tu : nombreCompleto(p)}
              marcada={marcadas.has(p.id)}
              onCambio={(si) => alternar(p.id, si)}
            />
          )
        })}
        {buscando && visibles.length === 0 && <div className={estilos.nadie}>{textos.nadieCoincide(busqueda.trim())}</div>}
      </div>
      <div className={estilos.pie}>
        <BotonPrincipal onClick={onListo}>{t.listo(n, gente.length)}</BotonPrincipal>
      </div>
    </div>
  )
}

function Fila({ icono, avatar, nombre, nota, marcada, onCambio }: { icono?: NombreIcono; avatar?: ReactNode; nombre: string; nota?: string; marcada: boolean; onCambio: (marcada: boolean) => void }) {
  return (
    <label className={estilos.fila}>
      <input type="checkbox" className={estilos.nativa} checked={marcada} onChange={(e) => onCambio(e.target.checked)} />
      {avatar ?? (
        <span className={estilos.circulo} aria-hidden="true">
          {icono && <Icono nombre={icono} medida={17} />}
        </span>
      )}
      <span className={estilos.textos}>
        <span className={estilos.nombre}>{nombre}</span>
        {nota && <span className={estilos.nota}>{nota}</span>}
      </span>
      <span className={estilos.casilla} aria-hidden="true">
        <Icono nombre="check" medida={16} trazo={3} />
      </span>
    </label>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from '../../componentes/Avatar.tsx'
import { Atras, Aviso, BotonBorde, BotonPrincipal, Hoja, Interruptor, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima, PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { diaLargo, diaLocal } from '../../datos/fechas.ts'
import { borrarGasto, conmigo, partesDe, plata, puedeCambiarGasto, rendir, usePartes, useRendiciones, type Gasto } from '../../datos/gastos.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useSinSubir } from '../../datos/sinSenal.ts'
import { useTextos } from '../../textos.ts'
import { iconoDe } from './categorias.ts'
import { DetalleBoleta } from './DetalleBoleta.tsx'
import estilos from './DetalleGasto.module.css'

type Props = { gasto: Gasto; computador: boolean; onCerrar: () => void; onEditar: () => void; onEliminado: (gasto: Gasto) => void }

// El detalle de un gasto (forma "Mezcla"): el ícono, el nombre y el monto; en color, lo que es para ti; quién pagó y
// la parte de cada uno; la boleta, "Rindo este gasto", quién lo anotó y "Eliminar gasto", que pregunta antes.
// En el celular ocupa la pantalla ("Gastos" vuelve); en el computador es el panel encima de la lista.
// "Editar" llama a onEditar; al eliminarlo, onEliminado (el contenedor cierra y muestra el aviso con Deshacer).
export function DetalleGasto(props: Props) {
  // Cada gasto parte de cero: sin pregunta abierta ni boleta en grande
  return <Detalle key={props.gasto.id} {...props} />
}

function Detalle({ gasto, computador, onCerrar, onEditar, onEliminado }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const { data: partes } = usePartes()
  const { data: rendiciones } = useRendiciones()
  const aviso = useAviso()
  const conectado = useConectado()
  const sinSubir = useSinSubir().has(gasto.id)
  const [preguntando, setPreguntando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  // Mientras se guarda, el interruptor muestra lo que tocaste
  const [rindiendo, setRindiendo] = useState<boolean | null>(null)
  const idPregunta = useId()
  // La pregunta para eliminar: el foco entra a ella y, si cancelas, vuelve a "Eliminar gasto"
  const botonEliminar = useRef<HTMLButtonElement>(null)
  const botonCancelar = useRef<HTMLButtonElement>(null)
  const hoja = useRef<HTMLDivElement>(null)
  const devolverFoco = useRef(false)
  useEffect(() => {
    if (preguntando) {
      if (computador) botonCancelar.current?.focus({ preventScroll: true })
      else hoja.current?.focus({ preventScroll: true })
    } else if (devolverFoco.current) botonEliminar.current?.focus({ preventScroll: true })
    devolverFoco.current = false
  }, [preguntando, computador])
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.gastos
  const d = t.detalle

  const solo = gasto.division === 'solo'
  const puede = puedeCambiarGasto(gasto, yo)
  const suyas = partes ? partesDe(gasto.id, partes) : null
  // Uno "solo" no necesita las partes para decir que es tuyo
  const relacion = solo || partes ? conmigo(gasto, partes ?? [], yo.id) : null
  const tengoParte = solo || (suyas?.some((p) => p.persona === yo.id && p.monto > 0) ?? false)
  const rindo = rindiendo ?? (rendiciones?.some((r) => r.gasto === gasto.id && r.persona === yo.id) ?? false)

  const persona = (id: string) => personas?.find((p) => p.id === id)
  const nombreDe = (id: string) => {
    const p = persona(id)
    return p ? primerNombre(p) : null
  }
  // Quien ya no está en el grupo (o mientras cargan las personas) queda como "Alguien"
  const nombre = (id: string) => (id === yo.id ? t.tu : (nombreDe(id) ?? (personas ? d.alguien : '')))
  // "Tú" en tu círculo; los demás, con su foto o sus iniciales
  const cara = (id: string, medida: number) =>
    id === yo.id ? (
      <span className={estilos.tu} style={{ width: medida, height: medida, fontSize: Math.round(medida * 0.42) }} aria-hidden="true">
        {t.tu}
      </span>
    ) : (
      <Avatar persona={persona(id) ?? { nombre: null, correo: '', foto: null }} medida={medida} />
    )

  // Tú primero y después el resto, por nombre
  const ordenadas = [...(suyas ?? [])].sort((a, b) => Number(b.persona === yo.id) - Number(a.persona === yo.id) || nombre(a.persona).localeCompare(nombre(b.persona), 'es'))
  // A quiénes se les mueve el saldo al eliminarlo: los que tienen parte y quien pagó
  const afectados = new Set([...(suyas ?? []).map((p) => p.persona), gasto.pagado_por]).size
  const explica = solo ? d.soloLoVes : d.seAjustan(afectados)

  // Quién lo anotó y cuándo; si fue otro día que el del gasto, también el día del gasto
  const anotadoEl = diaLocal(gasto.creado_en)
  const anoto = gasto.creado_por === yo.id ? d.anotaste(diaLargo(anotadoEl)) : d.anoto(nombreDe(gasto.creado_por), diaLargo(anotadoEl))
  const anotoTexto = anotadoEl === gasto.fecha ? anoto : `${d.gastoDel(diaLargo(gasto.fecha))} ${anoto}`
  // Si no lo puedes cambiar, quiénes sí (quien pagó y quien lo anotó)
  const quienes = [...new Set([gasto.pagado_por, gasto.creado_por])].map(nombreDe).filter((n) => n !== null)
  const soloPuede = !puede && quienes.length > 0 ? d.soloPuede(textos.y(quienes), quienes.length > 1) : null

  // ---------- Acciones ----------
  // Editar, la foto y eliminar necesitan conexión: sin señal se ven apagados y tocarlos avisa
  const conConexion = (accion: () => void) => () => {
    if (conectado) accion()
    else aviso.mostrar(d.necesitasConexion)
  }
  const cambiarRindo = async (si: boolean) => {
    if (rindiendo !== null) return
    setRindiendo(si)
    try {
      await rendir(gasto.id, si)
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
    setRindiendo(null)
  }
  const cancelar = () => {
    devolverFoco.current = true
    setPreguntando(false)
  }
  // Al eliminarlo, el contenedor cierra el gasto y muestra "Eliminaste …" con Deshacer
  const eliminar = async () => {
    if (eliminando) return
    setEliminando(true)
    try {
      await borrarGasto(gasto.id)
      onEliminado(gasto)
    } catch {
      setEliminando(false)
      setPreguntando(false)
      aviso.mostrar(textos.noSeGuardo)
    }
  }

  // ---------- Partes ----------
  const Titulo = computador ? 'h2' : 'h1'
  const encabezado = (
    <>
      <div className={estilos.titular}>
        <span className={estilos.icono}>
          <Icono nombre={iconoDe(gasto.categoria)} medida={26} />
        </span>
        <span className={estilos.nombres}>
          <Titulo className={estilos.titulo}>{gasto.titulo}</Titulo>
          <span className={estilos.monto}>{plata(gasto.monto)}</span>
        </span>
      </div>
      {sinSubir && (
        <div className={estilos.sinSubir}>
          <Icono nombre="sinSubir" medida={15} trazo={2} />
          {d.sinSubir}
        </div>
      )}
      {relacion && (
        <div className={estilos.resumen} data-tipo={relacion.tipo}>
          {relacion.tipo === 'solotuyo' && <Icono nombre="candado" medida={15} trazo={2.25} />}
          {relacion.tipo === 'prestaste'
            ? d.prestaste(plata(relacion.monto))
            : relacion.tipo === 'teprestaron'
              ? d.tePrestaron(plata(relacion.monto))
              : relacion.tipo === 'solotuyo'
                ? d.soloTuyo
                : d.noParticipas}
        </div>
      )}
    </>
  )

  const reparto = !solo && suyas && (
    <div className={estilos.reparto}>
      <div className={estilos.pago}>
        {cara(gasto.pagado_por, 34)}
        <span>
          {gasto.pagado_por === yo.id ? d.pagaste : d.pago(nombre(gasto.pagado_por))} <span className={estilos.fuerte}>{plata(gasto.monto)}</span>
        </span>
      </div>
      <div className={estilos.entre}>{d.entre(suyas.length, gasto.division === 'exactos')}</div>
      <ul className={estilos.partes}>
        {ordenadas.map((p) => (
          <li key={p.persona} className={estilos.parte} data-tu={p.persona === yo.id}>
            {cara(p.persona, computador ? 28 : 30)}
            <span className={estilos.parteNombre}>{nombre(p.persona)}</span>
            <span className={estilos.parteMonto}>{plata(p.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const cuerpo = (
    <>
      {reparto}
      <DetalleBoleta gasto={gasto} puede={puede} computador={computador} aviso={aviso} />
      {tengoParte && (
        <div className={estilos.rindo}>
          <Interruptor etiqueta={d.rindo} activo={rindo} onCambio={(si) => void cambiarRindo(si)} ultimo />
        </div>
      )}
      {(personas || gasto.creado_por === yo.id) && <div className={estilos.anoto}>{anotoTexto}</div>}
      {!computador && soloPuede && <div className={estilos.ajeno}>{soloPuede}</div>}
      {/* En el computador, la pregunta toma su lugar */}
      {puede && !(computador && preguntando) && (
        <button ref={botonEliminar} type="button" className={estilos.eliminar} aria-disabled={!conectado} aria-haspopup={computador ? undefined : 'dialog'} onClick={conConexion(() => setPreguntando(true))}>
          {d.eliminar}
        </button>
      )}
    </>
  )

  const editar = (
    <button type="button" className={computador ? estilos.editarPc : estilos.editar} aria-disabled={!conectado} onClick={conConexion(onEditar)}>
      <Icono nombre="lapiz" medida={18} trazo={2} />
      {d.editar}
    </button>
  )

  // ---------- Computador ----------
  if (computador) {
    return (
      <PanelEncima etiqueta={gasto.titulo} onCerrar={onCerrar} cabecera={
          <div className={estilos.cabeceraPc}>
            {puede && editar}
            <SinConexion />
          </div>
        }
        pie={soloPuede && <div className={estilos.soloPuede}>{soloPuede}</div>}>
        {encabezado}
        {cuerpo}
        {preguntando && (
          <div
            role="alertdialog"
            aria-labelledby={`${idPregunta}-titulo`}
            aria-describedby={`${idPregunta}-explica`}
            className={estilos.pregunta}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelar()
            }}
          >
            <div id={`${idPregunta}-titulo`} className={estilos.preguntaTitulo}>
              {d.eliminarPregunta(gasto.titulo)}
            </div>
            <p id={`${idPregunta}-explica`} className={estilos.preguntaExplica}>
              {explica}
            </p>
            <div className={estilos.preguntaBotones}>
              <button type="button" className={estilos.si} aria-disabled={eliminando} onClick={() => void eliminar()}>
                {d.eliminar}
              </button>
              <button ref={botonCancelar} type="button" className={estilos.no} onClick={cancelar}>
                {textos.cancelar}
              </button>
            </div>
          </div>
        )}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </PanelEncima>
    )
  }

  // ---------- Celular ----------
  return (
    <PantallaConPie>
      <div className={estilos.franja}>
        <div className={estilos.cabecera}>
          <Atras texto={t.titulo} onClick={onCerrar} />
          <span className={estilos.cabeceraDerecha}>
            <SinConexion sobrePanel />
            {puede && editar}
          </span>
        </div>
        {encabezado}
      </div>
      {cuerpo}
      <Hoja abierta={preguntando} etiqueta={d.eliminarPregunta(gasto.titulo)} alerta onCerrar={cancelar}>
        <div ref={hoja} tabIndex={-1} className={estilos.hoja}>
          <TituloHoja>{d.eliminarPregunta(gasto.titulo)}</TituloHoja>
          <p className={estilos.explica}>{explica}</p>
          <div className={estilos.hojaBotones}>
            <BotonPrincipal peligro ocupado={eliminando} onClick={() => void eliminar()}>
              {d.eliminar}
            </BotonPrincipal>
            <BotonBorde onClick={cancelar}>{textos.cancelar}</BotonBorde>
          </div>
        </div>
      </Hoja>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </PantallaConPie>
  )
}

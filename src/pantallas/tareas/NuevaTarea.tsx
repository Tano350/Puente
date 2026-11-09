import { useRef, useState } from 'react'
import { BotonPrincipal } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { estadoDe } from '../../datos/estadoTareas.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { borrarTarea, cambiarTarea, crearTarea, ErrorDeTarea, useAsignados, type DatosTarea, type Tarea } from '../../datos/tareas.ts'
import { useTextos } from '../../textos.ts'
import { activosDe, nombresDe, partesDeFecha } from './comun.ts'
import { ElegirPersonas } from './ElegirPersonas.tsx'
import estilos from './NuevaTarea.module.css'

export type AvisoDeTarea = { texto: string; deshacer: () => Promise<void> }

export type PropsNueva = {
  // En el computador va en la columna de la derecha; "Para quién" abre un menú en vez de una hoja
  computador: boolean
  // Si viene, edita esa tarea; si no, crea una nueva
  tarea?: Tarea
  onCerrar: () => void
  // Después de crear o guardar: el contenedor abre la tarea (o vuelve a ella) y muestra el aviso con "Deshacer"
  onListo: (tarea: Tarea, aviso: AvisoDeTarea) => void
}

// "Nueva tarea" y "Editar tarea": la hoja para llenar. En el celular tapa todo; en el computador es una tarjeta
// dentro de la columna de la derecha.
export function NuevaTarea(props: PropsNueva) {
  const sesion = useSesion()
  const { isPending } = useAsignados()
  // Al editar, espera a saber a quién está asignada antes de armar el borrador
  if (sesion.tipo !== 'dentro' || (props.tarea && isPending)) return null
  return <Formulario key={props.tarea?.id ?? 'nueva'} {...props} yo={sesion.persona.id} />
}

function Formulario({ computador, tarea, onCerrar, onListo, yo }: PropsNueva & { yo: string }) {
  const textos = useTextos()
  const t = textos.tareas.nueva
  const { data: personas } = usePersonas()
  const { data: asignados } = useAsignados()
  const sinRed = !useConectado()
  const total = activosDe(personas).size

  // Con qué datos parte: los de la tarea y quiénes la tienen, o los de una nueva
  const [antes] = useState<DatosTarea>(() => {
    if (!tarea) return { titulo: '', notas: null, para: null, cadaUno: false, personal: false, personas: [yo] }
    const estado = estadoDe(tarea, asignados ?? [], yo, activosDe(personas))
    return { titulo: tarea.titulo, notas: tarea.notas, para: tarea.para, cadaUno: tarea.cada_uno, personal: tarea.personal, personas: estado.modo === 'sin' ? [] : estado.personas }
  })
  const [titulo, setTitulo] = useState(antes.titulo)
  const [para, setPara] = useState(antes.para)
  const [elegidas, setElegidas] = useState(antes.personas)
  const [cadaUno, setCadaUno] = useState(antes.cadaUno)
  const [notas, setNotas] = useState(antes.notas ?? '')
  const [personal, setPersonal] = useState(antes.personal)
  const [eligiendo, setEligiendo] = useState(false)
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const tituloRef = useRef<HTMLTextAreaElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)
  // Para no crearla dos veces si tocan el botón seguido, antes de que se vea "ocupado"
  const enviando = useRef(false)

  // Lo personal solo lo cambia quien creó la tarea, y la base la deja solo tuya
  const puedeSerPersonal = !tarea || tarea.creada_por === yo
  const variasPersonas = !personal && elegidas.length >= 2

  const guardar = async () => {
    if (enviando.current) return
    const limpio = titulo.trim()
    if (!limpio) {
      setErrorTitulo(t.faltaTitulo)
      tituloRef.current?.focus()
      return
    }
    const datos: DatosTarea = { titulo: limpio, notas: notas.trim() || null, para, cadaUno: variasPersonas && cadaUno, personal, personas: personal ? [yo] : elegidas }
    enviando.current = true
    setGuardando(true)
    setFallo(null)
    let lista: Tarea
    try {
      lista = tarea ? await cambiarTarea(tarea.id, datos) : await crearTarea(datos)
    } catch (e) {
      const motivo = e instanceof ErrorDeTarea ? e.motivo : 'otro'
      if (motivo === 'titulo') {
        setErrorTitulo(t.faltaTitulo)
        tituloRef.current?.focus()
      } else if (motivo === 'persona' || motivo === 'no_esta' || motivo === 'no_asignado' || motivo === 'no_tomada') setFallo(textos.tareas.comun.motivos[motivo])
      else setFallo(textos.noSeGuardo)
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    const id = lista.id
    onListo(
      lista,
      tarea
        ? { texto: t.guardaste, deshacer: async () => void (await cambiarTarea(id, antes)) }
        : { texto: t.creaste(lista.titulo), deshacer: () => borrarTarea(id) },
    )
  }

  const abrirFecha = () => {
    try {
      fechaRef.current?.showPicker?.()
    } catch {
      // Sin selector propio: el campo de fecha, que cubre el bloque, se abre al tocarlo
    }
  }

  const nombreFila = !personal && elegidas.length > 0 ? (elegidas.length === total && total > 2 ? t.todosLos(total) : textos.y(nombresDe(elegidas, personas, yo, textos))) : textos.tareas.comun.sinAsignar
  const partes = para ? partesDeFecha(para) : null
  const heading = tarea ? t.editar : t.titulo

  const cuerpo = (
    <div className={estilos.cuerpo}>
      <div id="tarea-para-et" className={estilos.seccion}>
        {t.paraQuien}
      </div>
      <div className={estilos.paraQuien}>
        {personal ? (
          <div className={estilos.soloTu} id="tarea-para-valor">
            <Icono nombre="candado" medida={18} trazo={2} />
            {t.soloTu}
          </div>
        ) : (
          <button
            type="button"
            className={estilos.fila}
            aria-haspopup="dialog"
            aria-expanded={eligiendo}
            aria-labelledby="tarea-para-et tarea-para-valor"
            onClick={() => setEligiendo((v) => !v)}
          >
            <span id="tarea-para-valor" className={estilos.filaValor}>
              {nombreFila}
            </span>
            <span className={estilos.cambiar}>
              {t.cambiar}
              <Icono nombre="derecha" medida={18} trazo={2} />
            </span>
          </button>
        )}
        {!personal && <ElegirPersonas computador={computador} abierta={eligiendo} elegidas={elegidas} onCambio={setElegidas} onCerrar={() => setEligiendo(false)} />}
      </div>

      {variasPersonas && (
        <div role="radiogroup" aria-label={t.comoSeHace} className={estilos.radios}>
          {[
            { valor: false, texto: t.unoBasta },
            { valor: true, texto: t.cadaUno },
          ].map((opcion) => (
            <label key={opcion.texto} className={estilos.radio}>
              <input type="radio" name="tarea-como" className={estilos.radioNativo} checked={cadaUno === opcion.valor} onChange={() => setCadaUno(opcion.valor)} />
              <span className={estilos.circulo} aria-hidden="true" />
              {opcion.texto}
            </label>
          ))}
        </div>
      )}

      <label htmlFor="tarea-notas" className={estilos.seccion}>
        {t.notas} <span className={estilos.opcional}>{textos.opcional}</span>
      </label>
      <textarea id="tarea-notas" className={estilos.notas} rows={2} value={notas} placeholder={t.notasEjemplo} onChange={(e) => setNotas(e.target.value)} />

      {puedeSerPersonal && (
        <div className={estilos.personal}>
          <span className={estilos.personalTexto}>
            {t.personal}
            <span id="tarea-personal-nota" className={estilos.personalNota}>
              {t.soloTuLaVes}
            </span>
          </span>
          <button type="button" role="switch" aria-checked={personal} aria-label={t.personal} aria-describedby="tarea-personal-nota" className={estilos.interruptor} onClick={() => setPersonal((v) => !v)}>
            <span className={estilos.pista} data-activo={personal}>
              <span className={estilos.perilla} />
            </span>
          </button>
        </div>
      )}
    </div>
  )

  const banda = (
    <div className={estilos.campos}>
      <div className={estilos.colFecha}>
        <label htmlFor="tarea-fecha" className={estilos.et}>
          {t.fecha}
        </label>
        <div className={estilos.bloque}>
          {partes ? (
            <span className={estilos.valor} aria-hidden="true">
              <small>{partes.semana}</small>
              <b>{partes.dia}</b>
              <em>{partes.mes}</em>
            </span>
          ) : (
            <span className={estilos.vacio} aria-hidden="true">
              <Icono nombre="agenda" medida={24} />
              {textos.elegir}
            </span>
          )}
          <input ref={fechaRef} id="tarea-fecha" type="date" className={estilos.nativo} value={para ?? ''} onClick={abrirFecha} onChange={(e) => setPara(e.target.value || null)} />
        </div>
        {para && (
          <button type="button" className={estilos.quitar} onClick={() => setPara(null)}>
            {t.quitarFecha}
          </button>
        )}
      </div>
      <div className={estilos.colTitulo}>
        <label htmlFor="tarea-titulo" className={estilos.et}>
          {t.queHacer}
        </label>
        <textarea
          id="tarea-titulo"
          ref={tituloRef}
          className={estilos.titulo}
          rows={2}
          maxLength={200}
          value={titulo}
          aria-invalid={Boolean(errorTitulo)}
          aria-describedby={errorTitulo ? 'tarea-titulo-error' : undefined}
          autoFocus={computador && !tarea}
          onChange={(e) => {
            setTitulo(e.target.value.replace(/\s*\n\s*/g, ' '))
            setErrorTitulo(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
        />
        {errorTitulo && (
          <div id="tarea-titulo-error" className={estilos.error} role="alert">
            {errorTitulo}
          </div>
        )}
      </div>
    </div>
  )

  const boton = (
    <BotonPrincipal apagado={sinRed} ocupado={guardando} onClick={() => void guardar()}>
      {tarea ? t.guardar : t.crear}
    </BotonPrincipal>
  )
  // Sin conexión el botón queda apagado y lo escrito se queda donde está
  const notas2 = (
    <>
      {sinRed && <div className={estilos.nota}>{tarea ? t.sinRedGuardar : t.sinRedCrear}</div>}
      {fallo && (
        <div className={estilos.nota} role="alert">
          {fallo}
        </div>
      )}
    </>
  )

  if (computador) {
    return (
      <section aria-label={heading} className={estilos.tarjeta}>
        <div className={estilos.cabeza}>
          <div className={estilos.cabezaPc}>
            <h2 className={estilos.tituloPc}>{heading}</h2>
            <button type="button" aria-label={textos.cancelar} className={estilos.cerrar} onClick={onCerrar}>
              <Icono nombre="cerrar" medida={20} trazo={2} />
            </button>
          </div>
          {banda}
        </div>
        <div className={estilos.desplazable}>{cuerpo}</div>
        <div className={estilos.pie}>
          {boton}
          {notas2}
        </div>
      </section>
    )
  }

  return (
    <PantallaConPie
      encima
      pie={
        <>
          {boton}
          {notas2}
        </>
      }
    >
      <div className={estilos.cabeza} data-celular>
        <div className={estilos.cabezaCel}>
          <button type="button" className={estilos.cancelar} onClick={onCerrar}>
            {textos.cancelar}
          </button>
          <h1 className={estilos.tituloCel}>{heading}</h1>
          <span className={estilos.relleno} aria-hidden="true" />
        </div>
        {banda}
      </div>
      {cuerpo}
    </PantallaConPie>
  )
}

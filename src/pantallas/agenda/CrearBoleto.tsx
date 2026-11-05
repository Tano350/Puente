import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { BotonPrincipal, CampoTexto, Etiqueta, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import type { TipoEvento } from '../../datos/eventos.ts'
import { conMayuscula, diaLargo, type Ventana } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { CUPOS, conInicio, type Borrador, type Errores } from './CrearBorrador.ts'
import estilos from './CrearBoleto.module.css'

const TIPOS = ['visita', 'reunion', 'comida', 'otro'] as const satisfies readonly TipoEvento[]
const TALON = 96

// Íconos del boleto que no están en Icono.tsx

// La silueta: esquinas redondeadas y una muesca arriba y abajo donde empieza el talón
function silueta(ancho: number, alto: number) {
  const c = ancho - TALON
  return {
    borde: `M10.5 0.5 H${c - 10} A10 10 0 0 0 ${c + 10} 0.5 H${ancho - 10.5} A10 10 0 0 1 ${ancho - 0.5} 10.5 V${alto - 10.5} A10 10 0 0 1 ${ancho - 10.5} ${alto - 0.5} H${c + 10} A10 10 0 0 0 ${c - 10} ${alto - 0.5} H10.5 A10 10 0 0 1 0.5 ${alto - 10.5} V10.5 A10 10 0 0 1 10.5 0.5 Z`,
    corte: `M${c} 16 V${alto - 16}`,
  }
}

// Abre el selector del dispositivo al tocar (donde se puede)
function abrirSelector(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.()
  } catch {
    // Algunos navegadores no tienen selector de hora; se escribe en el campo
  }
}

type Props = {
  borrador: Borrador
  errores: Errores
  computador: boolean
  enfocar: boolean
  editando?: boolean
  viaje: Ventana
  onCambio: (cambios: Partial<Borrador>) => void
}

// El mismo boleto del detalle, con cada línea por llenar y el talón con el modo.
// Día, horas y tipo usan los selectores del dispositivo, invisibles encima de cada línea.
// Al editar uno cerrado, el talón no cuenta personas: esas se cambian en el evento.
export function CrearBoleto({ borrador, errores, computador, enfocar, editando = false, viaje, onCambio }: Props) {
  const textos = useTextos()
  const t = textos.agenda.crear
  const caja = useRef<HTMLDivElement>(null)
  const lineasRef = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLTextAreaElement>(null)
  const botonLugar = useRef<HTMLButtonElement>(null)
  const [ancho, setAncho] = useState(358)
  // Lo alto de las líneas: el boleto crece si el nombre baja de línea o aparece un error
  const [contenido, setContenido] = useState(0)
  const [editandoLugar, setEditandoLugar] = useState(false)
  // La hoja enfoca su primer campo al abrirse, así que no sabe volver: el foco vuelve a la línea del lugar
  const cerrarLugar = () => {
    setEditandoLugar(false)
    botonLugar.current?.focus({ preventScroll: true })
  }
  useLayoutEffect(() => {
    const elemento = caja.current
    if (!elemento) return
    const medir = () => {
      setAncho(elemento.clientWidth)
      setContenido(lineasRef.current?.offsetHeight ?? 0)
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    if (lineasRef.current) observador.observe(lineasRef.current)
    return () => observador.disconnect()
  }, [])
  // El nombre baja de línea en vez de cortarse
  const nombre = borrador.titulo
  useLayoutEffect(() => {
    const campo = tituloRef.current
    if (!campo) return
    campo.style.height = 'auto'
    campo.style.height = `${campo.scrollHeight + 2}px`
  }, [nombre, ancho, borrador.clase])

  const { clase, tipo, titulo, dia, empieza, termina, lugar, direccion, modo, cupos } = borrador
  const evento = clase === 'evento'
  const alto = Math.max(evento ? 200 : 140, contenido + 18)
  const { borde, corte } = silueta(ancho, alto)
  const lugarTexto = [lugar.trim(), direccion.trim()].filter(Boolean).join(', ')
  const errorHora = errores.hora ? 'crear-hora-error' : undefined
  // Cada error va bajo su línea
  const error = (campo: 'titulo' | 'dia' | 'hora') =>
    errores[campo] && (
      <div id={`crear-${campo}-error`} className={estilos.error} role="alert">
        <Icono nombre="alerta" medida={15} trazo={2} />
        {errores[campo]}
      </div>
    )

  const talon = !evento ? (
    <>
      <span className={estilos.rayado} aria-hidden="true" />
      <span className={`${estilos.talonTexto} ${estilos.bajoRayado}`}>{t.ocupado}</span>
    </>
  ) : modo === 'con_cupo' ? (
    <div role="group" aria-labelledby="crear-cupos" className={estilos.conCupo}>
      <span id="crear-cupos" className={estilos.talonTexto}>
        {t.cupos}
      </span>
      <span className={estilos.cupos} aria-live="polite">
        {cupos}
      </span>
      <span className={estilos.pasos}>
        <button
          type="button"
          className={estilos.paso}
          aria-label={t.menosCupos}
          aria-disabled={cupos <= CUPOS.min}
          onClick={() => {
            if (cupos > CUPOS.min) onCambio({ cupos: cupos - 1 })
          }}
        >
          <Icono nombre="menos" medida={16} trazo={2.25} />
        </button>
        <button
          type="button"
          className={estilos.paso}
          aria-label={t.masCupos}
          aria-disabled={cupos >= CUPOS.max}
          onClick={() => {
            if (cupos < CUPOS.max) onCambio({ cupos: cupos + 1 })
          }}
        >
          <Icono nombre="mas" medida={16} trazo={2.25} />
        </button>
      </span>
    </div>
  ) : modo === 'para_todos' ? (
    <>
      <Icono nombre="grupo" medida={32} trazo={1.75} />
      <span className={`${estilos.talonTexto} ${estilos.bajoIcono}`}>{t.modos.para_todos}</span>
    </>
  ) : (
    <>
      <Icono nombre="candado" medida={30} trazo={2} />
      <span className={`${estilos.talonTexto} ${estilos.bajoIcono}`}>{editando ? t.modos.cerrado : t.personas(borrador.elegidos.length)}</span>
    </>
  )

  return (
    <>
      <div ref={caja} className={estilos.boleto} data-computador={computador} style={{ height: alto }}>
        <svg className={estilos.silueta} width={ancho} height={alto} aria-hidden="true">
          <path d={borde} className={estilos.borde} />
          <path d={corte} className={estilos.corte} />
        </svg>
        <div ref={lineasRef} className={estilos.lineas}>
          {evento && (
            <span className={estilos.tipo} data-vacio={!tipo}>
              <span aria-hidden="true">{tipo ? textos.agenda.tipos[tipo] : t.eligeTipo}</span>
              <Icono nombre="abajo" medida={14} trazo={2} />
              <select className={estilos.nativo} aria-label={t.tipo} value={tipo ?? ''} onChange={(e) => onCambio({ tipo: e.target.value as TipoEvento })}>
                {!tipo && (
                  <option value="" disabled>
                    {t.eligeTipo}
                  </option>
                )}
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {textos.agenda.tipos[x]}
                  </option>
                ))}
              </select>
            </span>
          )}
          <textarea
            ref={tituloRef}
            id="crear-titulo"
            className={estilos.titulo}
            rows={1}
            value={titulo}
            placeholder={evento ? t.nombreEvento : t.queTienes}
            aria-label={evento ? t.nombreEvento : t.queTienes}
            aria-invalid={Boolean(errores.titulo)}
            aria-describedby={errores.titulo ? 'crear-titulo-error' : undefined}
            autoComplete="off"
            autoFocus={enfocar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            onChange={(e) => onCambio({ titulo: e.target.value.replace(/[\r\n]+/g, ' ') })}
          />
          {error('titulo')}
          <div className={estilos.fila} data-mal={Boolean(errores.dia)}>
            <span className={`${estilos.celda} ${estilos.resto}`} data-vacio={!dia}>
              <Icono nombre="agenda" medida={16} trazo={2} />
              <span className={estilos.recorte} aria-hidden="true">
                {dia ? conMayuscula(diaLargo(dia)) : t.eligeDia}
              </span>
              <input
                id="crear-dia"
                type="date"
                className={estilos.nativo}
                aria-label={t.dia}
                min={viaje.desde}
                max={viaje.hasta}
                value={dia ?? ''}
                aria-invalid={Boolean(errores.dia)}
                aria-describedby={errores.dia ? 'crear-dia-error' : undefined}
                onClick={abrirSelector}
                onChange={(e) => onCambio({ dia: e.target.value || null })}
              />
            </span>
          </div>
          {error('dia')}
          {/* Con la hora elegida, la línea se parte: lo de la izquierda cambia el inicio y lo de la derecha, el término */}
          <div className={estilos.fila} data-mal={Boolean(errores.hora)}>
            <span className={`${estilos.celda} ${empieza ? '' : estilos.resto}`} data-vacio={!empieza}>
              <Icono nombre="reloj" medida={16} trazo={2} />
              <span aria-hidden="true">{empieza ? t.horaA(empieza) : t.eligeHora}</span>
              <input
                id="crear-hora"
                type="time"
                step={300}
                className={estilos.nativo}
                aria-label={evento ? t.empieza : t.desde}
                value={empieza ?? ''}
                aria-invalid={Boolean(errores.hora)}
                aria-describedby={errorHora}
                onClick={abrirSelector}
                onChange={(e) => onCambio(conInicio(borrador, e.target.value.slice(0, 5) || null))}
              />
            </span>
            {empieza && (
              <span className={`${estilos.celda} ${estilos.resto} ${estilos.fin}`} data-vacio={!termina}>
                <span aria-hidden="true">{termina ?? t.sinHora}</span>
                <input
                  id="crear-fin"
                  type="time"
                  step={300}
                  className={estilos.nativo}
                  aria-label={evento ? t.termina : t.hasta}
                  value={termina ?? ''}
                  aria-invalid={Boolean(errores.hora)}
                  aria-describedby={errorHora}
                  onClick={abrirSelector}
                  onChange={(e) => onCambio({ termina: e.target.value.slice(0, 5) || null })}
                />
              </span>
            )}
          </div>
          {error('hora')}
          {evento && (
            <button ref={botonLugar} type="button" className={`${estilos.fila} ${estilos.lugar}`} data-vacio={!lugarTexto} onClick={() => setEditandoLugar(true)}>
              <Icono nombre="lugar" medida={16} trazo={2} />
              <span className={estilos.recorte}>
                {lugarTexto ? (
                  <>
                    <span className={estilos.oculto}>{t.lugar}: </span>
                    {lugarTexto}
                  </>
                ) : (
                  t.agregaLugar
                )}
              </span>
            </button>
          )}
        </div>
        <div className={estilos.talon}>{talon}</div>
      </div>

      <Hoja abierta={editandoLugar} etiqueta={t.lugar} onCerrar={cerrarLugar}>
        <TituloHoja>{t.lugar}</TituloHoja>
        {/* Enter en un campo también la cierra */}
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              cerrarLugar()
            }
          }}
        >
          <Etiqueta texto={t.nombreLugar} para="crear-lugar" />
          <CampoTexto id="crear-lugar" valor={lugar} autoComplete="off" autoFocus onCambio={(valor) => onCambio({ lugar: valor })} />
          <Etiqueta texto={t.direccion} para="crear-direccion" />
          <CampoTexto id="crear-direccion" valor={direccion} autoComplete="off" onCambio={(valor) => onCambio({ direccion: valor })} />
        </div>
        <div className={estilos.listo}>
          <BotonPrincipal onClick={cerrarLugar}>{t.listo}</BotonPrincipal>
        </div>
      </Hoja>
    </>
  )
}

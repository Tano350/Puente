import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { diaConSemana } from '../datos/fechas.ts'
import { cierraLaHoja, cuerpo, seguir, seVaElAviso, sinMovimiento, sonar, Valor } from '../movimiento/index.ts'
import { useTextos } from '../textos.ts'
import { Icono, type NombreIcono } from './Icono.tsx'
import { cerrarAvisos } from './useAviso.ts'
import estilos from './Controles.module.css'

// Piezas que se repiten en todas las pantallas, con las medidas del lienzo.

export function Atras({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button type="button" className={estilos.atras} onClick={onClick}>
      <Icono nombre="izquierda" medida={22} trazo={2} />
      {texto}
    </button>
  )
}

export function Titulo({ children, grande = false }: { children: ReactNode; grande?: boolean }) {
  return <h1 className={grande ? estilos.tituloGrande : estilos.titulo}>{children}</h1>
}

export function Bajada({ children }: { children: ReactNode }) {
  return <div className={estilos.bajada}>{children}</div>
}

// Barra de abajo con el botón principal de la pantalla
export function Pie({ children }: { children: ReactNode }) {
  return <div className={estilos.pie}>{children}</div>
}

type PropsBoton = { children: ReactNode; onClick?: () => void; apagado?: boolean; ocupado?: boolean; peligro?: boolean; icono?: NombreIcono }

export function BotonPrincipal({ children, onClick, apagado = false, ocupado = false, peligro = false, icono }: PropsBoton) {
  return (
    <button
      type="button"
      className={`${estilos.principal} ${peligro ? estilos.peligro : ''}`}
      aria-disabled={apagado || ocupado}
      onClick={() => {
        if (!apagado && !ocupado) onClick?.()
      }}
    >
      {icono && <Icono nombre={icono} medida={20} trazo={2.25} />}
      {children}
    </button>
  )
}

export function BotonBorde({ children, onClick, icono }: PropsBoton) {
  return (
    <button type="button" className={estilos.borde} onClick={onClick}>
      {icono && <Icono nombre={icono} medida={20} />}
      {children}
    </button>
  )
}

export function Etiqueta({ texto, opcional = false, para }: { texto: string; opcional?: boolean; para: string }) {
  const textos = useTextos()
  return (
    <label className={estilos.etiqueta} htmlFor={para}>
      {texto}
      {opcional && <span className={estilos.opcional}> {textos.opcional}</span>}
    </label>
  )
}

export function ErrorCampo({ texto, id }: { texto?: string | null; id: string }) {
  if (!texto) return null
  return (
    <div className={estilos.error} id={id} role="alert">
      {texto}
    </div>
  )
}

type PropsTexto = {
  id: string
  valor: string
  onCambio: (valor: string) => void
  error?: string | null
  multilinea?: boolean
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'url'
  lista?: string
  autoFocus?: boolean
}

export function CampoTexto({ id, valor, onCambio, error, multilinea = false, placeholder, autoComplete, inputMode, lista, autoFocus }: PropsTexto) {
  const clase = `${multilinea ? estilos.campoLargo : estilos.campo} ${error ? estilos.campoMal : ''}`
  const comun = {
    id,
    className: clase,
    value: valor,
    placeholder,
    autoComplete,
    autoFocus,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
  }
  // Correos y enlaces se escriben tal cual: sin mayúscula inicial ni corrector
  const literal = inputMode === 'email' || inputMode === 'url'
  return (
    <>
      {multilinea ? (
        <textarea {...comun} rows={2} onChange={(e) => onCambio(e.target.value)} />
      ) : (
        <input
          {...comun}
          type={inputMode === 'email' ? 'email' : 'text'}
          inputMode={inputMode}
          autoCapitalize={literal ? 'none' : undefined}
          spellCheck={literal ? false : undefined}
          list={lista}
          onChange={(e) => onCambio(e.target.value)}
        />
      )}
      <ErrorCampo texto={error} id={`${id}-error`} />
    </>
  )
}

// Fecha con el formato del diseño ("Sáb 16 ene"); al tocarla se abre el calendario del dispositivo
export function CampoFecha({ id, etiqueta, valor, min, max, onCambio, error }: { id: string; etiqueta: string; valor: string | null; min?: string; max?: string; onCambio: (valor: string | null) => void; error?: string | null }) {
  const textos = useTextos()
  return (
    <div>
      <Etiqueta texto={etiqueta} para={id} />
      <div className={`${estilos.fecha} ${error ? estilos.campoMal : ''}`}>
        <span className={valor ? undefined : estilos.vacio}>{valor ? diaConSemana(valor) : textos.elegir}</span>
        <Icono nombre="agenda" medida={18} trazo={2} />
        <input
          id={id}
          type="date"
          className={estilos.fechaNativa}
          value={valor ?? ''}
          min={min}
          max={max}
          aria-invalid={Boolean(error)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          onChange={(e) => onCambio(e.target.value || null)}
        />
      </div>
      <ErrorCampo texto={error} id={`${id}-error`} />
    </div>
  )
}

// La pista de un interruptor: al cambiar, la perilla salta al otro lado con resorte (el CSS la deja en su lugar
// nuevo; parte desde donde se veía)
export function Pista({ activo }: { activo: boolean }) {
  const perilla = useRef<HTMLSpanElement>(null)
  const antes = useRef(activo)
  useLayoutEffect(() => {
    if (antes.current === activo || !perilla.current) return
    antes.current = activo
    const c = cuerpo(perilla.current)
    c.pos({ x: c.p.x + (activo ? -20 : 20) }).meta({ x: 0 })
    sonar('tick')
  }, [activo])
  return (
    <span className={estilos.pista} data-activo={activo}>
      <span ref={perilla} className={estilos.perilla} />
    </span>
  )
}

export function Interruptor({ etiqueta, activo, onCambio, ultimo = false }: { etiqueta: string; activo: boolean; onCambio: (activo: boolean) => void; ultimo?: boolean }) {
  return (
    <div className={`${estilos.interruptorFila} ${ultimo ? estilos.ultimo : ''}`}>
      <span className={estilos.interruptorTexto}>{etiqueta}</span>
      <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} className={estilos.interruptor} onClick={() => onCambio(!activo)}>
        <Pista activo={activo} />
      </button>
    </div>
  )
}

// La misma fila de un Grupo, con un interruptor en vez de la flecha: toda la fila lo cambia
export function FilaInterruptor({ etiqueta, activo, onCambio }: { etiqueta: string; activo: boolean; onCambio: (activo: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={activo} className={estilos.fila} onClick={() => onCambio(!activo)}>
      <span className={estilos.filaEtiqueta}>{etiqueta}</span>
      <Pista activo={activo} />
    </button>
  )
}

export function Grupo({ children, arriba = 20 }: { children: ReactNode; arriba?: number }) {
  return (
    <div className={estilos.grupo} style={{ marginTop: arriba }}>
      {children}
    </div>
  )
}

export function Fila({ etiqueta, valor, onClick, sinFlecha = false, icono }: { etiqueta: string; valor?: string; onClick?: () => void; sinFlecha?: boolean; icono?: NombreIcono }) {
  return (
    <button type="button" className={estilos.fila} onClick={onClick}>
      {icono && <span className={estilos.filaIcono}><Icono nombre={icono} medida={22} /></span>}
      <span className={estilos.filaEtiqueta}>{etiqueta}</span>
      {valor && <span className={estilos.filaValor}>{valor}</span>}
      {!sinFlecha && (
        <span className={estilos.filaFlecha}>
          <Icono nombre="derecha" medida={18} trazo={2} />
        </span>
      )}
    </button>
  )
}

// Hoja que sube desde abajo con resorte, con el fondo oscurecido. Se baja con el dedo (desde cualquier parte que no
// se esté desplazando) o tocando el fondo. Al cerrarse baja y recién entonces se quita; mientras baja ya no es un
// diálogo para el lector de pantalla. Va en el body (portal), para que no la mueva lo que se mueve en la pantalla.
export function Hoja({ abierta, etiqueta, onCerrar, alerta = false, children }: { abierta: boolean; etiqueta: string; onCerrar: () => void; alerta?: boolean; children: ReactNode }) {
  const textos = useTextos()
  const [montada, setMontada] = useState(abierta)
  if (abierta && !montada) setMontada(true)
  // Mientras baja, sigue mostrando lo último que tenía (quien la abrió puede haber borrado sus datos)
  const contenido = useRef<ReactNode>(children)
  if (abierta) contenido.current = children
  const hoja = useRef<HTMLDivElement>(null)
  const velo = useRef<HTMLButtonElement>(null)
  const alto = useRef(1)
  const y = useRef<Valor | null>(null)
  if (!y.current) {
    y.current = new Valor(0, (v) => {
      if (hoja.current) hoja.current.style.translate = Math.abs(v) < 0.01 ? '' : `0 ${v.toFixed(2)}px`
      if (velo.current) velo.current.style.opacity = String(Math.min(1, Math.max(0, 1 - v / alto.current)))
    })
  }

  useLayoutEffect(() => {
    const el = hoja.current
    const valor = y.current
    if (!el || !valor) return
    alto.current = Math.max(1, el.offsetHeight)
    if (abierta) {
      valor.alQuieto = null
      // Parte desde abajo (la primera vez) o desde donde iba bajando; se aplica antes de dibujar, sin destello
      valor.fijar(valor.x === 0 && valor.m === 0 ? alto.current + 30 : valor.x)
      valor.ir(0)
      return
    }
    if (sinMovimiento()) {
      setMontada(false)
      return
    }
    let listo = false
    const quitar = () => {
      if (listo) return
      listo = true
      setMontada(false)
    }
    valor.alQuieto = quitar
    valor.ir(alto.current + 60)
    const reloj = window.setTimeout(quitar, 900)
    return () => window.clearTimeout(reloj)
  }, [abierta, montada])

  useEffect(() => {
    if (abierta) sonar('hoja')
  }, [abierta])

  const arrastrar = (e: EventoPuntero<HTMLDivElement>) => {
    const valor = y.current
    const objetivo = e.target
    if (!abierta || !valor || !(objetivo instanceof Element) || objetivo.closest('input, textarea, select, [contenteditable="true"]')) return
    // Si lo tocado está dentro de algo desplazado hacia abajo, primero se desplaza eso
    for (let n: Element | null = objetivo; n && n !== e.currentTarget; n = n.parentElement) if (n.scrollTop > 0) return
    const desde = valor.x
    seguir(e, {
      eje: 'y',
      sentido: 1,
      alMover: (p) => valor.fijar(desde + (p.dy >= 0 ? p.dy : p.dy * 0.18)),
      alSoltar: (p, cancelado) => {
        if (!cancelado && cierraLaHoja(valor.x, alto.current, p.vy)) {
          valor.v = Math.max(0, p.vy)
          onCerrar()
        } else valor.ir(0)
      },
    })
  }

  useEffect(() => {
    if (!abierta) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [abierta, onCerrar])
  // Al cerrar, el foco vuelve a lo que abrió la hoja
  useEffect(() => {
    if (!abierta) return
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [abierta])
  if (!montada) return null
  const bajando = !abierta
  return createPortal(
    <div className={estilos.hojaFondo} data-bajando={bajando || undefined}>
      <button type="button" ref={velo} aria-label={textos.cerrar} className={estilos.hojaVelo} data-sin-hundido tabIndex={bajando ? -1 : undefined} onClick={onCerrar} />
      <div
        ref={hoja}
        role={bajando ? undefined : alerta ? 'alertdialog' : 'dialog'}
        aria-modal={bajando ? undefined : true}
        aria-label={bajando ? undefined : etiqueta}
        aria-hidden={bajando || undefined}
        inert={bajando || undefined}
        className={estilos.hoja}
        onPointerDown={arrastrar}
      >
        <div aria-hidden="true" className={estilos.manilla} />
        {contenido.current}
      </div>
    </div>,
    document.body,
  )
}

export function TituloHoja({ children }: { children: ReactNode }) {
  return <h2 className={estilos.tituloHoja}>{children}</h2>
}

// Aviso abajo, sobre la barra de secciones (o sobre el botón fijo de la pantalla, si tiene uno).
// En el computador, con un panel encima abierto, se centra en lo que queda a la vista.
// Con "accion" lleva otro botón en vez de Deshacer (por ejemplo "Entendido"); "arriba" lo pone arriba, para un aviso
// que se queda hasta que lo cierran sin tapar los avisos ni los botones de abajo (el texto puede ocupar varias líneas).
export function Aviso({
  texto,
  onDeshacer,
  accion,
  sobrePie = false,
  conPanel = false,
  arriba = false,
}: {
  texto: string | null
  onDeshacer?: () => void
  accion?: { texto: string; alHacer: () => void }
  sobrePie?: boolean
  conPanel?: boolean
  arriba?: boolean
}) {
  const textos = useTextos()
  const boton = accion ?? (onDeshacer && { texto: textos.deshacer, alHacer: onDeshacer })
  // Entra con resorte; al irse baja (o sube, si va arriba) y recién entonces se quita. Mientras sale muestra lo último.
  const [montado, setMontado] = useState(Boolean(texto))
  if (texto && !montado) setMontado(true)
  const ultimo = useRef({ texto, boton })
  if (texto) ultimo.current = { texto, boton }
  const caja = useRef<HTMLDivElement>(null)
  // Se tiró hacia el lado: ya se fue, no hace falta animar la salida
  const tirado = useRef(false)

  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const c = cuerpo(el)
    if (texto) {
      tirado.current = false
      c.alQuieto = null
      c.fijar({ x: 0, r: 0 })
      c.pos({ y: arriba ? -40 : 46, s: 0.92 }).meta({ y: 0, s: 1 })
      return
    }
    if (tirado.current || sinMovimiento()) {
      setMontado(false)
      return
    }
    let listo = false
    const quitar = () => {
      if (listo) return
      listo = true
      setMontado(false)
    }
    c.alQuieto = quitar
    c.meta({ y: arriba ? -110 : 110, s: 0.96 })
    const reloj = window.setTimeout(quitar, 900)
    return () => window.clearTimeout(reloj)
  }, [texto, montado, arriba])

  // Se descarta tirándolo hacia el lado (el que queda arriba hasta que lo cierran, no)
  const tirar = (e: EventoPuntero<HTMLDivElement>) => {
    const el = caja.current
    if (arriba || !texto || !el) return
    const c = cuerpo(el)
    const ancho = el.offsetWidth
    seguir(e, {
      eje: 'x',
      alMover: (p) => c.fijar({ x: p.dx, r: Math.max(-5, Math.min(5, p.dx / 45)) }),
      alSoltar: (p, cancelado) => {
        if (cancelado || !seVaElAviso(p.dx, ancho, p.vx)) {
          c.meta({ x: 0, r: 0 })
          return
        }
        tirado.current = true
        const lado = Math.sign(p.dx || p.vx) || 1
        c.meta({ x: lado * (ancho + 80), r: 0 }).vel({ x: p.vx })
        c.alQuieto = () => cerrarAvisos()
        window.setTimeout(cerrarAvisos, 700)
        sonar('tick')
      },
    })
  }

  if (!montado) return null
  const mostrado = texto ? { texto, boton } : ultimo.current
  return createPortal(
    <div
      ref={caja}
      role={texto ? 'status' : undefined}
      aria-hidden={texto ? undefined : true}
      data-saliendo={texto ? undefined : true}
      className={`${estilos.aviso} ${sobrePie ? estilos.avisoSobrePie : ''} ${conPanel ? estilos.avisoConPanel : ''} ${arriba ? estilos.avisoArriba : ''}`}
      onPointerDown={tirar}
    >
      <span className={estilos.avisoTexto}>{mostrado.texto}</span>
      {mostrado.boton && (
        <button type="button" className={estilos.deshacer} tabIndex={texto ? undefined : -1} onClick={mostrado.boton.alHacer}>
          {mostrado.boton.texto}
        </button>
      )}
    </div>,
    document.body,
  )
}

import { useEffect, type ReactNode } from 'react'
import { diaConSemana } from '../datos/fechas.ts'
import { Icono, type NombreIcono } from './Icono.tsx'
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
  return (
    <label className={estilos.etiqueta} htmlFor={para}>
      {texto}
      {opcional && <span className={estilos.opcional}> (opcional)</span>}
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
export function CampoFecha({ id, etiqueta, valor, min, max, onCambio, error }: { id: string; etiqueta: string; valor: string | null; min: string; max: string; onCambio: (valor: string | null) => void; error?: string | null }) {
  return (
    <div>
      <Etiqueta texto={etiqueta} para={id} />
      <div className={`${estilos.fecha} ${error ? estilos.campoMal : ''}`}>
        <span className={valor ? undefined : estilos.vacio}>{valor ? diaConSemana(valor) : 'Elegir'}</span>
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

export function Interruptor({ etiqueta, activo, onCambio, ultimo = false }: { etiqueta: string; activo: boolean; onCambio: (activo: boolean) => void; ultimo?: boolean }) {
  return (
    <div className={`${estilos.interruptorFila} ${ultimo ? estilos.ultimo : ''}`}>
      <span className={estilos.interruptorTexto}>{etiqueta}</span>
      <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} className={estilos.interruptor} onClick={() => onCambio(!activo)}>
        <span className={estilos.pista} data-activo={activo}>
          <span className={estilos.perilla} />
        </span>
      </button>
    </div>
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

// Hoja que sube desde abajo, con el fondo oscurecido
export function Hoja({ abierta, etiqueta, onCerrar, alerta = false, children }: { abierta: boolean; etiqueta: string; onCerrar: () => void; alerta?: boolean; children: ReactNode }) {
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
  if (!abierta) return null
  return (
    <div className={estilos.hojaFondo}>
      <button type="button" aria-label="Cerrar" className={estilos.hojaVelo} onClick={onCerrar} />
      <div role={alerta ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={etiqueta} className={estilos.hoja}>
        <div aria-hidden="true" className={estilos.manilla} />
        {children}
      </div>
    </div>
  )
}

export function TituloHoja({ children }: { children: ReactNode }) {
  return <h2 className={estilos.tituloHoja}>{children}</h2>
}

// Aviso abajo, sobre la barra de secciones (o sobre el botón fijo de la pantalla, si tiene uno).
// En el computador, con un panel encima abierto, se centra en lo que queda a la vista.
export function Aviso({ texto, onDeshacer, sobrePie = false, conPanel = false }: { texto: string | null; onDeshacer?: () => void; sobrePie?: boolean; conPanel?: boolean }) {
  if (!texto) return null
  return (
    <div role="status" className={`${estilos.aviso} ${sobrePie ? estilos.avisoSobrePie : ''} ${conPanel ? estilos.avisoConPanel : ''}`}>
      <span className={estilos.avisoTexto}>{texto}</span>
      {onDeshacer && (
        <button type="button" className={estilos.deshacer} onClick={onDeshacer}>
          Deshacer
        </button>
      )}
    </div>
  )
}

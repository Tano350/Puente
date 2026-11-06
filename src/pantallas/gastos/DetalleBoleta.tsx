import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from '../../componentes/Icono.tsx'
import { consultas } from '../../datos/consultas.ts'
import { prepararBoleta, quitarBoleta, quitarBoletaConCopia, subirBoleta, useUrlBoleta, type Gasto } from '../../datos/gastos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleBoleta.module.css'

type Avisos = { mostrar: (texto: string, deshacer?: () => void) => void; cerrar: () => void }

// La boleta de un gasto: "Ver boleta", con la foto en chico, la abre en grande; ahí, si la puedes cambiar, "Quitar
// foto" la quita, con aviso y Deshacer. Si no hay y lo puedes cambiar, "Agregar foto de la boleta" la achica y la
// sube al tiro, también con aviso y Deshacer.
// "libre": se puede cambiar ahora (con señal, o un gasto que todavía no sube: la foto espera con él).
export function DetalleBoleta({ gasto, puede, libre, computador, aviso }: { gasto: Gasto; puede: boolean; libre: boolean; computador: boolean; aviso: Avisos }) {
  const textos = useTextos()
  const d = textos.gastos.detalle
  const { data: url, isError } = useUrlBoleta(gasto.boleta)
  const [viendo, setViendo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(false)
  // Por qué no se quitó, dicho en el visor: el aviso de abajo queda tapado por él. Lo de la señal se borra solo al
  // volver la conexión.
  const [nota, setNota] = useState<'sinRed' | 'fallo' | null>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (!elegido || subiendo) return
    setSubiendo(true)
    let foto: Blob
    try {
      foto = await prepararBoleta(elegido)
    } catch {
      setSubiendo(false)
      aviso.mostrar(d.noSeAbrio)
      return
    }
    try {
      await subirBoleta(gasto, foto)
      // Deshacer la quita con la ruta nueva, para que también se borre el archivo
      const conBoleta = consultas.getQueryData<Gasto[]>(['gastos'])?.find((g) => g.id === gasto.id && g.boleta)
      const deshacer = conBoleta ? () => void quitarBoleta(conBoleta).then(aviso.cerrar, () => aviso.mostrar(textos.noSeGuardo)) : undefined
      aviso.mostrar(d.agregasteFoto, deshacer)
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
    setSubiendo(false)
  }

  // Quitarla deja una copia en memoria: Deshacer la vuelve a subir. El visor se cierra y el aviso queda a la vista.
  const quitar = async () => {
    if (!libre) {
      setNota('sinRed')
      return
    }
    if (quitando) return
    setQuitando(true)
    setNota(null)
    try {
      const copia = await quitarBoletaConCopia(gasto)
      setViendo(false)
      aviso.mostrar(d.quitasteFoto, () => {
        const ahora = consultas.getQueryData<Gasto[]>(['gastos'])?.find((g) => g.id === gasto.id) ?? { ...gasto, boleta: null, boleta_por: null }
        void subirBoleta(ahora, copia).then(aviso.cerrar, () => aviso.mostrar(textos.noSeGuardo))
      })
    } catch {
      setNota('fallo')
    }
    setQuitando(false)
  }
  const textoNota = nota === 'fallo' ? textos.noSeGuardo : nota === 'sinRed' && !libre ? d.necesitasConexion : null

  // "Agregar foto" y "Ver boleta" son el mismo botón (misma clave): al subirla o quitarla, el foco se queda ahí
  if (gasto.boleta) {
    return (
      <>
        <button
          key="boleta"
          type="button"
          className={estilos.ver}
          aria-haspopup="dialog"
          onClick={() => {
            setNota(null)
            setViendo(true)
          }}
        >
          <span className={estilos.miniatura} aria-hidden="true">
            {url && <img src={url} alt="" />}
          </span>
          <span className={estilos.verTexto}>{d.verBoleta}</span>
          <span className={estilos.flecha}>
            <Icono nombre="derecha" medida={18} trazo={2} />
          </span>
        </button>
        {viendo && (
          <VisorBoleta
            titulo={d.boletaDe(gasto.titulo)}
            url={url}
            fallo={isError}
            onCerrar={() => setViendo(false)}
            pie={
              puede && (
                <>
                  <p role="status" className={estilos.visorNota}>
                    {textoNota}
                  </p>
                  {/* Sin señal se ve apagado, como el resto del detalle, y tocarlo dice por qué */}
                  <button type="button" className={estilos.visorQuitar} aria-disabled={quitando || !libre} data-sin-red={!libre} onClick={() => void quitar()}>
                    <Icono nombre="basura" medida={18} trazo={2} />
                    {quitando ? d.quitando : d.quitarFoto}
                  </button>
                </>
              )
            }
          />
        )}
      </>
    )
  }
  if (!puede) return null
  return (
    <>
      <button
        key="boleta"
        type="button"
        className={estilos.agregar}
        aria-disabled={subiendo || !libre}
        data-sin-red={!libre}
        onClick={() => {
          // Subir la foto necesita conexión: sin señal, el botón sigue ahí pero avisa
          if (!libre) aviso.mostrar(d.necesitasConexion)
          else if (!subiendo) archivo.current?.click()
        }}
      >
        <Icono nombre="camara" medida={computador ? 18 : 20} />
        {subiendo ? d.subiendo : d.agregarFoto}
      </button>
      <input ref={archivo} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className={estilos.archivo} onChange={(e) => void alElegir(e)} />
    </>
  )
}

// La boleta en grande, sobre todo y siempre oscura. "Cerrar", Escape o tocar afuera de la foto la cierran.
// "titulo" va tal cual arriba (también la usa "Nuevo gasto", con la foto todavía sin subir); "pie" va debajo de la
// foto (en el detalle, "Quitar foto" para quien la puede cambiar).
export function VisorBoleta({ titulo, url, fallo, onCerrar, pie }: { titulo: string; url: string | null | undefined; fallo: boolean; onCerrar: () => void; pie?: ReactNode }) {
  const textos = useTextos()
  const d = textos.gastos.detalle
  const idTitulo = useId()
  const visor = useRef<HTMLDivElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  // Al abrirla, el foco va a "Cerrar"; al cerrarla, vuelve a "Ver boleta"
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cerrar.current?.focus({ preventScroll: true })
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      // El foco pasa solo entre los botones del visor: no se va a la pantalla de atrás
      if (e.key === 'Tab') {
        e.preventDefault()
        const botones = Array.from(visor.current?.querySelectorAll('button') ?? [])
        const i = botones.findIndex((b) => b === document.activeElement)
        botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length]?.focus()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  // Va directo en el documento, para quedar encima de todo (también del panel del computador)
  return createPortal(
    <div ref={visor} role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={estilos.visor} data-con-pie={Boolean(pie)}>
      <div className={estilos.visorCabeza}>
        <h2 id={idTitulo} className={estilos.visorTitulo}>
          {titulo}
        </h2>
        <button ref={cerrar} type="button" className={estilos.visorCerrar} onClick={onCerrar}>
          {textos.cerrar}
        </button>
      </div>
      <div
        className={estilos.visorFoto}
        onClick={(e) => {
          if (e.target === e.currentTarget) onCerrar()
        }}
      >
        {url ? <img className={estilos.visorImagen} src={url} alt={d.foto} /> : fallo && <p className={estilos.visorFallo}>{d.noSeCargo}</p>}
      </div>
      {pie && <div className={estilos.visorPie}>{pie}</div>}
    </div>,
    document.body,
  )
}


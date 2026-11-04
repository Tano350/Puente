import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from '../../componentes/Icono.tsx'
import { consultas } from '../../datos/consultas.ts'
import { prepararBoleta, quitarBoleta, subirBoleta, useUrlBoleta, type Gasto } from '../../datos/gastos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleBoleta.module.css'

type Avisos = { mostrar: (texto: string, deshacer?: () => void) => void; cerrar: () => void }

// La boleta de un gasto: "Ver boleta", con la foto en chico, la abre en grande. Si no hay y lo puedes cambiar,
// "Agregar foto de la boleta" la achica y la sube al tiro, con aviso y Deshacer.
export function DetalleBoleta({ gasto, puede, computador, aviso }: { gasto: Gasto; puede: boolean; computador: boolean; aviso: Avisos }) {
  const textos = useTextos()
  const d = textos.gastos.detalle
  const { data: url, isError } = useUrlBoleta(gasto.boleta)
  const [viendo, setViendo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
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

  // "Agregar foto" y "Ver boleta" son el mismo botón (misma clave): al subirla o quitarla, el foco se queda ahí
  if (gasto.boleta) {
    return (
      <>
        <button key="boleta" type="button" className={estilos.ver} aria-haspopup="dialog" onClick={() => setViendo(true)}>
          <span className={estilos.miniatura} aria-hidden="true">
            {url && <img src={url} alt="" />}
          </span>
          <span className={estilos.verTexto}>{d.verBoleta}</span>
          <span className={estilos.flecha}>
            <Icono nombre="derecha" medida={18} trazo={2} />
          </span>
        </button>
        {viendo && <DetalleVisor titulo={gasto.titulo} url={url} fallo={isError} onCerrar={() => setViendo(false)} />}
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
        aria-disabled={subiendo}
        onClick={() => {
          if (!subiendo) archivo.current?.click()
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
function DetalleVisor({ titulo, url, fallo, onCerrar }: { titulo: string; url: string | undefined; fallo: boolean; onCerrar: () => void }) {
  const textos = useTextos()
  const d = textos.gastos.detalle
  const idTitulo = useId()
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
      // "Cerrar" es lo único que se puede tocar: el foco no se va a la pantalla de atrás
      if (e.key === 'Tab') {
        e.preventDefault()
        cerrar.current?.focus()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  // Va directo en el documento, para quedar encima de todo (también del panel del computador)
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={estilos.visor}>
      <div className={estilos.visorCabeza}>
        <h2 id={idTitulo} className={estilos.visorTitulo}>
          {d.boletaDe(titulo)}
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
    </div>,
    document.body,
  )
}


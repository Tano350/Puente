import { useRef, useState } from 'react'
import { BotonPrincipal } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { cambiarTema, crearTema, ErrorDeTema, type Tema } from '../../datos/intereses.ts'
import { useTextos } from '../../textos.ts'
import estilos from './TemaFormulario.module.css'

type Props = {
  // En el computador va en la columna de la derecha
  computador: boolean
  // Si viene, edita ese tema; si no, crea uno nuevo
  tema?: Tema
  sinRed: boolean
  // Sin conexión, al tocar el botón
  onSinRed: () => void
  onCerrar: () => void
  onListo: (tema: Tema) => void
}

// «Nuevo tema» y «Editar tema»: nombre y de qué se trata. En el celular tapa todo; en el computador queda a la derecha.
export function TemaFormulario({ computador, tema, sinRed, onSinRed, onCerrar, onListo }: Props) {
  const textos = useTextos()
  const t = textos.intereses.editar
  const [nombre, setNombre] = useState(tema?.nombre ?? '')
  const [trata, setTrata] = useState(tema?.de_que_trata ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  // Para no guardar dos veces si tocan el botón seguido, antes de que se vea «ocupado»
  const enviando = useRef(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const guardar = async () => {
    if (enviando.current) return
    const limpio = nombre.trim()
    if (!limpio) {
      setError(t.faltaNombre)
      nombreRef.current?.focus()
      return
    }
    enviando.current = true
    setGuardando(true)
    setFallo(null)
    let listo: Tema
    try {
      const deQueTrata = trata.trim() || null
      listo = tema ? await cambiarTema(tema.id, limpio, deQueTrata) : await crearTema(limpio, deQueTrata)
    } catch (e) {
      const motivo = e instanceof ErrorDeTema ? e.motivo : 'otro'
      if (motivo === 'nombre') setError(t.faltaNombre)
      else if (motivo === 'repetido') setError(t.repetido(limpio))
      else setFallo(textos.noSeGuardo)
      if (motivo === 'nombre' || motivo === 'repetido') nombreRef.current?.focus()
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    onListo(listo)
  }

  const titulo = tema ? t.editar : t.nuevo
  const campos = (
    <div className={estilos.campos}>
      <label htmlFor="tema-nombre" className={estilos.et}>
        {t.nombre}
      </label>
      <input
        id="tema-nombre"
        ref={nombreRef}
        className={estilos.campo}
        type="text"
        maxLength={40}
        value={nombre}
        autoFocus={computador && !tema}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'tema-nombre-error' : undefined}
        onChange={(e) => {
          setNombre(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void guardar()
        }}
      />
      {error && (
        <div id="tema-nombre-error" className={estilos.error} role="alert">
          {error}
        </div>
      )}
      <label htmlFor="tema-trata" className={`${estilos.et} ${estilos.segundo}`}>
        {t.deQueTrata} <span className={estilos.opcional}>{textos.opcional}</span>
      </label>
      <textarea id="tema-trata" className={`${estilos.campo} ${estilos.largo}`} rows={3} maxLength={160} value={trata} onChange={(e) => setTrata(e.target.value)} />
    </div>
  )

  const boton = (
    <>
      {fallo && (
        <div className={estilos.fallo} role="alert">
          {fallo}
        </div>
      )}
      <div onClick={() => sinRed && onSinRed()}>
        <BotonPrincipal apagado={sinRed} ocupado={guardando} onClick={() => void guardar()}>
          {tema ? t.guardar : t.crear}
        </BotonPrincipal>
      </div>
    </>
  )

  if (computador) {
    return (
      <section aria-label={titulo} className={estilos.tarjeta}>
        <div className={estilos.cabezaPc}>
          <h2 className={estilos.tituloPc}>{titulo}</h2>
          <span className={estilos.derecha}>
            <SinConexion sobrePanel />
            <button type="button" aria-label={textos.cancelar} className={estilos.cerrar} onClick={onCerrar}>
              <Icono nombre="cerrar" medida={20} trazo={2} />
            </button>
          </span>
        </div>
        <div className={estilos.desplazable}>{campos}</div>
        <div className={estilos.pie}>{boton}</div>
      </section>
    )
  }

  return (
    <PantallaConPie encima pie={boton}>
      <div className={estilos.cabeza}>
        <div className={estilos.cabezaCel}>
          <button type="button" className={estilos.cancelar} onClick={onCerrar}>
            {textos.cancelar}
          </button>
          <h1 className={estilos.tituloCel}>{titulo}</h1>
          <span className={estilos.relleno}>
            <SinConexion sobrePanel />
          </span>
        </div>
      </div>
      {campos}
    </PantallaConPie>
  )
}

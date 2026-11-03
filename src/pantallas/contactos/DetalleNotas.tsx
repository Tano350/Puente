import { useEffect, useRef, useState } from 'react'
import { BotonBorde, BotonPrincipal, CampoTexto } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { agregarNota, borrarNota, useNotas, type Contacto, type Nota } from '../../datos/contactos.ts'
import { conMayuscula, diaCorto, diaLocal, hoyAqui } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleNotas.module.css'


type Avisos = { mostrar: (texto: string, deshacer?: () => void) => void; cerrar: () => void }

// Las notas del contacto, de la más nueva a la más vieja, y el cuadro para escribir una.
// Cualquiera que ve el contacto puede agregar notas; las personales las ve solo quien las escribe.
export function DetalleNotas({ contacto, yo, aviso }: { contacto: Contacto; yo: Persona; aviso: Avisos }) {
  const textos = useTextos()
  const { data: todas } = useNotas()
  const { data: personas } = usePersonas()
  const [escribiendo, setEscribiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [personal, setPersonal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const agregar = useRef<HTMLButtonElement>(null)
  const redactar = useRef<HTMLDivElement>(null)
  // Al abrirse, el cuadro se ve entero (en el computador, sin quedar bajo el botón de abajo)
  useEffect(() => {
    if (escribiendo) redactar.current?.scrollIntoView({ block: 'nearest' })
  }, [escribiendo])
  const t = textos.contactos
  const d = t.detalle
  const campo = `nota-${contacto.id}`

  const notas = (todas ?? []).filter((n) => n.contacto === contacto.id).reverse()
  const hoy = hoyAqui()
  const autorYDia = (n: Nota) => {
    const dia = diaLocal(n.creada_en)
    const cuando = dia === hoy ? d.hoy : diaCorto(dia)
    if (n.autor === yo.id) return d.autorYDia(t.tu, cuando)
    const autor = personas?.find((p) => p.id === n.autor)
    return autor ? d.autorYDia(primerNombre(autor), cuando) : conMayuscula(cuando)
  }

  const cerrar = () => {
    setEscribiendo(false)
    setTexto('')
    setPersonal(false)
    agregar.current?.focus()
  }
  const guardar = async () => {
    const limpio = texto.trim()
    if (!limpio || guardando) return
    setGuardando(true)
    try {
      const nota = await agregarNota({ contacto: contacto.id, texto: limpio, personal })
      cerrar()
      aviso.mostrar(d.agregasteNota, () => void borrarNota(nota.id).then(aviso.cerrar, () => aviso.mostrar(textos.noSeGuardo)))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={estilos.notas}>
      <div className={estilos.cabeza}>
        <span className={estilos.rotulo}>{t.notas}</span>
        <button
          ref={agregar}
          type="button"
          className={estilos.agregar}
          aria-expanded={escribiendo}
          aria-controls={escribiendo ? campo : undefined}
          onClick={() => (escribiendo ? document.getElementById(campo)?.focus() : setEscribiendo(true))}
        >
          <Icono nombre="mas" medida={16} trazo={2.25} />
          {d.agregarNota}
        </button>
      </div>
      {escribiendo && (
        // Ctrl o Cmd + Enter guarda, como en otras apps
        <div
          ref={redactar}
          className={estilos.redactar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void guardar()
          }}
        >
          <label htmlFor={campo} className={estilos.oculto}>
            {d.notaNueva}
          </label>
          <CampoTexto id={campo} valor={texto} onCambio={setTexto} multilinea autoFocus />
          <div className={estilos.personal}>
            <Icono nombre="candado" medida={20} />
            <label htmlFor={`${campo}-personal`} className={estilos.personalTexto}>
              <span>{t.personal}</span>
              <span className={estilos.personalDetalle}>{t.soloTuLoVes}</span>
            </label>
            <button id={`${campo}-personal`} type="button" role="switch" aria-checked={personal} className={estilos.interruptor} onClick={() => setPersonal(!personal)}>
              <span className={estilos.pista} data-activo={personal}>
                <span className={estilos.perilla} />
              </span>
            </button>
          </div>
          <div className={estilos.botones}>
            <BotonPrincipal apagado={!texto.trim()} ocupado={guardando} onClick={() => void guardar()}>
              {d.guardarNota}
            </BotonPrincipal>
            <BotonBorde onClick={cerrar}>{textos.cancelar}</BotonBorde>
          </div>
        </div>
      )}
      {notas.map((n) => (
        <div key={n.id} className={estilos.nota}>
          <div className={estilos.texto}>{n.texto}</div>
          <div className={estilos.meta}>
            <span>{autorYDia(n)}</span>
            {n.personal && (
              <span className={estilos.marca}>
                <Icono nombre="candado" medida={12} trazo={2.25} />
                {t.personal}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

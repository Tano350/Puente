import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BotonBorde, BotonPrincipal } from '../../componentes/Controles.tsx'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima, PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import type { TablesUpdate } from '../../datos/base.ts'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { agregarContacto, cambiarContacto, useContactos, type Canal, type Contacto } from '../../datos/contactos.ts'
import { plano } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './NuevoContacto.module.css'

type Props = { computador: boolean; contacto?: Contacto; onCerrar: () => void; onListo: (contacto: Contacto, como: 'agregado' | 'guardado') => void }
type Borrador = { organizacion: string; nombre: string; canal: Canal; dato: string; responsable: string; personal: boolean; notas: string }
type Errores = { nombre?: string; dato?: string }

const CANALES = ['correo', 'linkedin', 'telefono'] as const satisfies readonly Canal[]
const TECLADO = { correo: 'email', linkedin: 'url', telefono: 'tel' } as const satisfies Record<Canal, string>
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Un enlace cualquiera o "linkedin.com/in/…", con o sin www
const LINKEDIN_VALIDO = /^(https?:\/\/\S+\.\S+|([\w-]+\.)*linkedin\.com\/\S+)$/i
// Lo que se puede cambiar al editar
const CAMPOS = ['nombre', 'organizacion', 'canal', 'dato', 'responsable', 'personal'] as const

// El mismo nombre, sin fijarse en tildes, mayúsculas ni espacios de más
const comparable = (nombre: string) => plano(nombre).trim().replace(/\s+/g, ' ')

function borradorDe(contacto: Contacto | undefined, yo: string): Borrador {
  return {
    organizacion: contacto?.organizacion ?? '',
    nombre: contacto?.nombre ?? '',
    canal: contacto?.canal ?? 'correo',
    dato: contacto?.dato ?? '',
    responsable: contacto?.responsable ?? yo,
    personal: contacto?.personal ?? false,
    notas: '',
  }
}

// "Nuevo contacto" y "Editar contacto": la tarjeta para llenar.
// En el celular tapa todo; en el computador es el panel encima del tablero.
export function NuevoContacto({ computador, contacto, onCerrar, onListo }: Props) {
  // Cada contacto (o uno nuevo) parte con su propio borrador
  return <FormularioContacto key={contacto?.id ?? 'nuevo'} computador={computador} contacto={contacto} onCerrar={onCerrar} onListo={onListo} />
}

function FormularioContacto({ computador, contacto, onCerrar, onListo }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const { data: personas } = usePersonas()
  const { data: contactos } = useContactos()
  const sinRed = !useConectado()
  const [borrador, setBorrador] = useState(() => borradorDe(contacto, sesion.tipo === 'dentro' ? sesion.persona.id : ''))
  const [errores, setErrores] = useState<Errores>({})
  const [eligiendo, setEligiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  const datoRef = useRef<HTMLInputElement>(null)
  // Para no agregarlo dos veces si tocan el botón seguido, antes de que se vea "ocupado"
  const enviando = useRef(false)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const tc = textos.contactos
  const t = tc.nuevo

  const nombreDe = (id: string) => {
    const persona = personas?.find((p) => p.id === id)
    return persona ? primerNombre(persona) : ''
  }
  const cambiar = (cambios: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambios }))
  const sinError = (campo: keyof Errores) => setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e))

  // Lo personal queda a tu cargo, y la base lo deja solo a quien creó el contacto
  const aCargo = borrador.personal ? yo.id : borrador.responsable
  const tuyo = aCargo === yo.id
  const avisa = !tuyo && aCargo !== contacto?.responsable
  const puedeSerPersonal = !contacto || contacto.creado_por === yo.id

  // Avisa si ya hay otro contacto con ese nombre, pero no impide agregarlo. Mientras se guarda, la lista se recarga con
  // el contacto nuevo: ese no cuenta como "ya existe"
  const creado = useRef<string | null>(null)
  const buscado = comparable(borrador.nombre)
  const existente =
    buscado && !guardando && (!contacto || buscado !== comparable(contacto.nombre))
      ? contactos?.find((c) => c.id !== contacto?.id && c.id !== creado.current && comparable(c.nombre) === buscado)
      : undefined

  const validar = (): Errores => {
    const dato = borrador.dato.trim()
    let errorDato: string | undefined
    if (dato && borrador.canal === 'correo' && !CORREO_VALIDO.test(dato)) errorDato = t.correoIncompleto
    if (dato && borrador.canal === 'linkedin' && !LINKEDIN_VALIDO.test(dato)) errorDato = t.linkedinIncompleto
    return { nombre: borrador.nombre.trim() ? undefined : t.faltaNombre, dato: errorDato }
  }

  const guardar = async () => {
    if (enviando.current) return
    const nuevos = validar()
    setErrores(nuevos)
    if (nuevos.nombre || nuevos.dato) {
      const campo = nuevos.nombre ? nombreRef.current : datoRef.current
      campo?.focus()
      return
    }
    const dato = borrador.dato.trim()
    const datos = {
      nombre: borrador.nombre.trim(),
      organizacion: borrador.organizacion.trim() || null,
      canal: dato ? borrador.canal : null,
      dato: dato || null,
      responsable: aCargo,
      personal: borrador.personal,
    }
    // Al editar se mandan solo los cambios; sin cambios no hay nada que guardar
    const cambiados = contacto ? CAMPOS.filter((campo) => datos[campo] !== contacto[campo]) : []
    enviando.current = true
    setGuardando(true)
    setFallo(false)
    let listo: Contacto
    try {
      if (!contacto) {
        listo = await agregarContacto(datos, { texto: borrador.notas, personal: borrador.personal })
        creado.current = listo.id
      } else if (cambiados.length) listo = await cambiarContacto(contacto.id, Object.fromEntries(cambiados.map((campo) => [campo, datos[campo]])) as TablesUpdate<'contactos'>)
      else listo = contacto
    } catch {
      setFallo(true)
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    onListo(listo, contacto ? 'guardado' : 'agregado')
  }

  const titulo = contacto ? t.editar : t.titulo
  const boton = (
    <BotonPrincipal apagado={sinRed} onClick={() => void guardar()} ocupado={guardando}>
      {contacto ? t.guardar : t.agregar}
    </BotonPrincipal>
  )
  // Sin conexión el botón queda apagado y lo escrito se queda donde está
  const notaSinRed = sinRed && <div className={estilos.nota}>{contacto ? t.sinRedGuardar : t.sinRedAgregar}</div>
  const noSeGuardo = fallo && (
    <div className={estilos.nota} role="alert">
      {textos.noSeGuardo}
    </div>
  )

  const formulario = (
    <div className={estilos.formulario} data-computador={computador}>
      <div className={estilos.tarjeta}>
        <span className={estilos.cinta}>
          <span className={estilos.cintaMedida} aria-hidden="true">
            {borrador.organizacion || t.organizacion}
          </span>
          <input
            id="nuevo-organizacion"
            className={estilos.cintaCampo}
            value={borrador.organizacion}
            placeholder={t.organizacion}
            aria-label={t.organizacion}
            autoComplete="off"
            onChange={(e) => cambiar({ organizacion: e.target.value })}
          />
        </span>
        <input
          id="nuevo-nombre"
          ref={nombreRef}
          className={estilos.nombre}
          value={borrador.nombre}
          placeholder={t.nombreEjemplo}
          aria-label={t.nombre}
          aria-invalid={Boolean(errores.nombre)}
          aria-describedby={errores.nombre ? 'nuevo-nombre-error' : undefined}
          autoComplete="off"
          autoFocus={computador && !contacto}
          onChange={(e) => {
            cambiar({ nombre: e.target.value })
            sinError('nombre')
          }}
        />
        <div className={estilos.separador} aria-hidden="true" />
        <div className={estilos.canalFila}>
          <div role="group" aria-label={t.canal} className={estilos.canales}>
            {CANALES.map((canal) => (
              <button
                key={canal}
                type="button"
                className={estilos.canal}
                aria-label={tc.canales[canal]}
                aria-pressed={borrador.canal === canal}
                onClick={() => {
                  cambiar({ canal })
                  sinError('dato')
                }}
              >
                <Icono nombre={canal} medida={18} />
              </button>
            ))}
          </div>
          <input
            id="nuevo-dato"
            ref={datoRef}
            className={estilos.dato}
            value={borrador.dato}
            placeholder={t.ejemplos[borrador.canal]}
            aria-label={tc.canales[borrador.canal]}
            aria-invalid={Boolean(errores.dato)}
            aria-describedby={errores.dato ? 'nuevo-dato-error' : undefined}
            inputMode={TECLADO[borrador.canal]}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              cambiar({ dato: e.target.value })
              sinError('dato')
            }}
          />
        </div>
      </div>

      {(errores.nombre || errores.dato) && (
        <div className={estilos.errores} role="alert">
          {errores.nombre && (
            <div id="nuevo-nombre-error" className={estilos.error}>
              <Icono nombre="alerta" medida={15} trazo={2} />
              {errores.nombre}
            </div>
          )}
          {errores.dato && (
            <div id="nuevo-dato-error" className={estilos.error}>
              <Icono nombre="alerta" medida={15} trazo={2} />
              {errores.dato}
            </div>
          )}
        </div>
      )}

      {existente && (
        <div className={estilos.existe} role="status">
          <Icono nombre="info" medida={18} trazo={2} />
          <span className={estilos.existeTexto}>
            {existente.responsable === yo.id ? t.yaExisteTuyo(existente.nombre) : t.yaExiste(existente.nombre, nombreDe(existente.responsable) || null)}
          </span>
          <button type="button" className={estilos.verContacto} onClick={() => navigate(`/contactos/${existente.id}`)}>
            {t.verContacto}
          </button>
        </div>
      )}

      <div className={estilos.filas}>
        <button
          type="button"
          className={estilos.responsable}
          aria-disabled={borrador.personal}
          onClick={() => {
            if (!borrador.personal) setEligiendo(true)
          }}
        >
          <Icono nombre="perfil" medida={20} />
          <span className={estilos.filaTexto}>
            <span className={estilos.filaNota}>{tc.responsable}</span>
            <span className={estilos.responsableNombre} data-tu={tuyo}>
              {tuyo ? tc.tu : nombreDe(aCargo)}
            </span>
            {avisa && <span className={estilos.filaNota}>{t.recibiraAviso(nombreDe(aCargo))}</span>}
          </span>
          {!borrador.personal && <Icono nombre="derecha" medida={18} trazo={2} />}
        </button>
        {puedeSerPersonal && (
          <div className={estilos.personal}>
            <Icono nombre="candado" medida={20} />
            <span className={estilos.filaTexto}>
              <span className={estilos.personalTitulo}>{tc.personal}</span>
              <span id="nuevo-personal-nota" className={estilos.filaNota}>
                {tc.soloTuLoVes}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={borrador.personal}
              aria-label={tc.personal}
              aria-describedby="nuevo-personal-nota"
              className={estilos.interruptor}
              onClick={() => cambiar({ personal: !borrador.personal })}
            >
              <span className={estilos.pista} data-activo={borrador.personal}>
                <span className={estilos.perilla} />
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Al editar no hay notas: viven en el detalle */}
      {!contacto && (
        <>
          <label className={estilos.etiqueta} htmlFor="nuevo-notas">
            {tc.notas}
          </label>
          <textarea id="nuevo-notas" className={estilos.notas} rows={2} value={borrador.notas} placeholder={t.notasEjemplo} onChange={(e) => cambiar({ notas: e.target.value })} />
        </>
      )}
    </div>
  )

  const elegir = (
    <ElegirPersona
      abierta={eligiendo}
      titulo={tc.elegirResponsable}
      elegida={aCargo}
      onElegir={(persona) => {
        cambiar({ responsable: persona.id })
        setEligiendo(false)
      }}
      onCerrar={() => setEligiendo(false)}
    />
  )

  if (computador) {
    return (
      <>
        <PanelEncima
          etiqueta={titulo}
          onCerrar={onCerrar}
          cabecera={
            <div className={estilos.cabeceraPc}>
              <h2 className={estilos.tituloPanel}>{titulo}</h2>
              <SinConexion sobrePanel />
            </div>
          }
          pie={
            <>
              <div className={estilos.botones}>
                {boton}
                <BotonBorde onClick={onCerrar}>{textos.cancelar}</BotonBorde>
              </div>
              {notaSinRed}
              {noSeGuardo}
            </>
          }
        >
          {formulario}
        </PanelEncima>
        {elegir}
      </>
    )
  }

  return (
    <>
      <PantallaConPie
        encima
        pie={
          <>
            {boton}
            {notaSinRed}
            {noSeGuardo}
          </>
        }
      >
        <div className={estilos.cabeza}>
          <div className={estilos.cabezaFila}>
            <button type="button" className={estilos.cancelar} onClick={onCerrar}>
              {textos.cancelar}
            </button>
            <SinConexion />
          </div>
          <h1 className={estilos.titulo}>{titulo}</h1>
        </div>
        {formulario}
      </PantallaConPie>
      {elegir}
    </>
  )
}

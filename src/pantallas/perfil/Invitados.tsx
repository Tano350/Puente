import { useEffect, useRef, useState, type Ref } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Avatar } from '../../componentes/Avatar.tsx'
import { Buscador } from '../../componentes/Buscador.tsx'
import { Atras, Aviso, BotonBorde, BotonPrincipal, CampoTexto, Etiqueta, Hoja, Pie, Titulo, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { diaCorto, diaLocal, hoyAqui } from '../../datos/fechas.ts'
import { coincide, porNombre } from '../../datos/grupo.ts'
import { devolver, ENLACE_DE_PUENTE, enlaceDeWhatsApp, ErrorAlInvitar, invitar, sacar } from '../../datos/invitados.ts'
import { carreraCorta, nombreCompleto, primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './Invitados.module.css'

const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// El correo se puede cortar después de la @, para que no se parta en cualquier parte
const correoCortable = (correo: string) => correo.replace('@', '@​')

type Panel = 'persona' | 'invitar' | 'sacar'

function Marca({ children }: { children: string }) {
  return <span className={estilos.marca}>{children}</span>
}

function Sobre({ medida }: { medida: number }) {
  return (
    <span className={estilos.sobre} style={{ width: medida, height: medida }} aria-hidden="true">
      <Icono nombre="correo" medida={Math.round(medida * 0.45)} />
    </span>
  )
}

type PropsFormulario = {
  nombre: string
  onNombre: (nombre: string) => void
  correo: string
  onCorreo: (correo: string) => void
  error: string | null
  ocupado: boolean
  onEnviar: () => void
  onCancelar: () => void
}

function FormularioInvitar({ nombre, onNombre, correo, onCorreo, error, ocupado, onEnviar, onCancelar }: PropsFormulario) {
  const textos = useTextos()
  const t = textos.invitados
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar()
      }}
    >
      <Etiqueta texto={t.nombre} opcional para="invitar-nombre" />
      <CampoTexto id="invitar-nombre" valor={nombre} onCambio={onNombre} autoComplete="off" placeholder={t.ejemploNombre} autoFocus />
      <Etiqueta texto={t.correo} para="invitar-correo" />
      <CampoTexto id="invitar-correo" valor={correo} onCambio={onCorreo} error={error} inputMode="email" autoComplete="off" placeholder={t.ejemplo} />
      {/* Con dos campos, Enter solo envía si hay un botón de envío */}
      <button type="submit" hidden />
      <div className={estilos.botones}>
        <BotonPrincipal onClick={onEnviar} ocupado={ocupado}>{t.invitar}</BotonPrincipal>
        <BotonBorde onClick={onCancelar}>{textos.cancelar}</BotonBorde>
      </div>
    </form>
  )
}

export function Invitados() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const esComputador = useEsComputador()
  const { data: personas } = usePersonas()
  const aviso = useAviso()
  const conectado = useConectado()
  const [busqueda, setBusqueda] = useState('')
  // En el celular las acciones van en hojas; en el computador, en el panel de la derecha
  const [hoja, setHoja] = useState<'invitar' | 'opciones' | 'sacar' | null>(null)
  const [panel, setPanel] = useState<Panel>('persona')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [correo, setCorreo] = useState('')
  // Recién invitada: en vez del formulario se ofrece mandarle el enlace por WhatsApp
  const [invitada, setInvitada] = useState<Persona | null>(null)
  // Al invitar, el formulario se cambia por lo que sigue y el foco va a WhatsApp, el paso que viene
  const enlaceListo = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (invitada) enlaceListo.current?.focus()
  }, [invitada])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  if (!yo.administra) return <Navigate to="/perfil" replace />
  const t = textos.invitados

  const activas = [yo, ...(personas ?? []).filter((p) => p.id !== yo.id)].filter((p) => !p.sacada_en)
  const sinEntrar = activas.filter((p) => !p.entro_en).sort((a, b) => b.invitada_en.localeCompare(a.invitada_en))
  const dentro = activas.filter((p) => p.entro_en).sort(porNombre)
  const resumen = sinEntrar.length === 0 ? t.entraronTodos(activas.length) : t.entraron(dentro.length, activas.length)
  const sinEntrarVisibles = sinEntrar.filter((p) => coincide(p, busqueda))
  const dentroVisibles = dentro.filter((p) => coincide(p, busqueda))
  const elegida = activas.find((p) => p.id === elegidaId) ?? sinEntrar[0] ?? dentro.find((p) => p.id !== yo.id) ?? null
  const nombre = nombreCompleto
  const invitadoEl = (p: Persona) => {
    const dia = diaLocal(p.invitada_en)
    return dia === hoyAqui() ? t.invitadoHoy : t.invitadoEl(diaCorto(dia))
  }

  // ---------- Acciones ----------
  const copiar = async (texto: string, listo: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      aviso.mostrar(listo)
    } catch {
      aviso.mostrar(t.noSePudo)
    }
  }
  const copiarEnlace = () => void copiar(ENLACE_DE_PUENTE, t.copiasteEnlace)
  const copiarCorreo = (p: Persona) => {
    setHoja(null)
    void copiar(p.correo, t.copiasteCorreo(primerNombre(p)))
  }
  const abrirInvitar = () => {
    if (!conectado) return aviso.mostrar(t.necesitasInvitar)
    setNombreNuevo('')
    setCorreo('')
    setInvitada(null)
    setError(null)
    aviso.cerrar()
    if (esComputador) setPanel('invitar')
    else setHoja('invitar')
  }
  const cerrar = () => {
    setHoja(null)
    setPanel('persona')
    setInvitada(null)
    setError(null)
  }
  const devolverA = async (p: Persona) => {
    try {
      await devolver(p.id)
      aviso.cerrar()
      setElegidaId(p.id)
    } catch {
      aviso.mostrar(t.noSePudo)
    }
  }
  // Sacar a alguien necesita conexión: sin señal, en vez de la pregunta sale el aviso
  const pedirSacar = (seguir: () => void) => {
    if (conectado) return seguir()
    setHoja(null)
    aviso.mostrar(t.necesitasSacar)
  }
  const enviar = async () => {
    const limpio = correo.trim().toLowerCase()
    if (!limpio) return setError(t.faltaCorreo)
    if (!CORREO_VALIDO.test(limpio)) return setError(t.correoIncompleto)
    if (activas.some((p) => p.correo === limpio)) return setError(t.yaInvitado)
    if (!conectado) return setError(t.necesitasInvitar)
    setOcupado(true)
    try {
      const nueva = await invitar(limpio, nombreNuevo)
      setElegidaId(nueva.id)
      setInvitada(nueva)
    } catch (e) {
      const motivo = e instanceof ErrorAlInvitar ? e.motivo : 'otro'
      setError(motivo === 'yaInvitado' ? t.yaInvitado : motivo === 'correoIncompleto' ? t.correoIncompleto : t.noSePudo)
    } finally {
      setOcupado(false)
    }
  }
  const sacarA = async (p: Persona) => {
    try {
      await sacar(p.id)
      cerrar()
      const texto = p.entro_en ? t.sacaste(primerNombre(p)) : t.sacasteInvitacion(p.correo)
      aviso.mostrar(texto, () => void devolverA(p))
    } catch {
      cerrar()
      aviso.mostrar(t.noSePudo)
    }
  }

  // ---------- Filas ----------
  const tituloSeccion = (texto: string, n: number, primera: boolean) => (
    <div className={estilos.seccion} data-primera={primera}>
      <span>{texto}</span>
      <span>{n}</span>
    </div>
  )

  const filaSinEntrar = (p: Persona) => {
    const texto = (
      <>
        <Sobre medida={40} />
        <span className={estilos.quien}>
          <span className={estilos.nombre}>{nombre(p)}</span>
          <span className={esComputador ? estilos.correoRecortado : estilos.correo} data-chico="true">{esComputador ? p.correo : correoCortable(p.correo)}</span>
          <span className={estilos.dato}>{invitadoEl(p)}</span>
        </span>
      </>
    )
    return (
      <div key={p.id} className={estilos.fila} data-elegida={esComputador && elegida?.id === p.id}>
        {esComputador ? (
          <button type="button" className={estilos.elegir} aria-pressed={elegida?.id === p.id} onClick={() => { setElegidaId(p.id); setPanel('persona') }}>
            {texto}
          </button>
        ) : (
          <span className={estilos.elegir}>{texto}</span>
        )}
        <button type="button" className={estilos.chico} onClick={copiarEnlace}>
          {t.copiarEnlace}
        </button>
      </div>
    )
  }

  const filaDentro = (p: Persona) => {
    const tuyo = p.id === yo.id
    const texto = (
      <>
        <Avatar persona={p} medida={40} />
        <span className={estilos.quien}>
          <span className={estilos.nombreFila}>
            <span className={estilos.nombre}>{nombre(p)}</span>
            {tuyo && <Marca>{t.tu}</Marca>}
            {p.administra && <Marca>{t.admin}</Marca>}
          </span>
          <span className={estilos.correoRecortado} data-chico="true">{p.correo}</span>
        </span>
      </>
    )
    return (
      <div key={p.id} className={estilos.fila} data-elegida={esComputador && elegida?.id === p.id}>
        {esComputador ? (
          <button type="button" className={estilos.elegir} aria-pressed={elegida?.id === p.id} onClick={() => { setElegidaId(p.id); setPanel('persona') }}>
            {texto}
          </button>
        ) : (
          <span className={estilos.elegir}>{texto}</span>
        )}
        {!esComputador && !tuyo && (
          <button type="button" className={estilos.opciones} aria-label={t.opcionesDe(primerNombre(p))} onClick={() => { setElegidaId(p.id); setHoja('opciones') }}>
            <Icono nombre="opciones" medida={20} trazo={2} />
          </button>
        )}
      </div>
    )
  }

  const lista = (
    <>
      {sinEntrarVisibles.length > 0 && (
        <div>
          {tituloSeccion(t.sinEntrar, sinEntrarVisibles.length, true)}
          {sinEntrarVisibles.map(filaSinEntrar)}
        </div>
      )}
      {dentroVisibles.length > 0 && (
        <div>
          {tituloSeccion(t.yaEntraron, dentroVisibles.length, sinEntrarVisibles.length === 0)}
          {dentroVisibles.map(filaDentro)}
        </div>
      )}
      {sinEntrarVisibles.length + dentroVisibles.length === 0 && <div className={estilos.nadie}>{textos.nadieCoincide(busqueda.trim())}</div>}
    </>
  )

  const formulario = (
    <FormularioInvitar
      nombre={nombreNuevo}
      onNombre={setNombreNuevo}
      correo={correo}
      onCorreo={(nuevo) => {
        setCorreo(nuevo)
        setError(null)
      }}
      error={error}
      ocupado={ocupado}
      onEnviar={() => void enviar()}
      onCancelar={cerrar}
    />
  )

  // Mandar el enlace por WhatsApp: se abre con el mensaje escrito, para elegir a quién va
  const whatsapp = (p: Persona, ref?: Ref<HTMLAnchorElement>) => (
    <a ref={ref} className={estilos.whatsapp} href={enlaceDeWhatsApp(t.mensajeWhatsApp(p.correo, ENLACE_DE_PUENTE))} target="_blank" rel="noopener noreferrer">
      <Icono nombre="compartir" medida={20} trazo={2.25} />
      {t.compartirWhatsApp}
    </a>
  )

  // Lo que se ve justo después de invitar, en la hoja (celular) o en el panel (computador)
  const listoInvitacion = (p: Persona) => (
    <>
      <div className={estilos.explica}>{p.correo}</div>
      <div className={estilos.botones}>
        {whatsapp(p, enlaceListo)}
        <BotonBorde onClick={cerrar}>{t.listo}</BotonBorde>
        <button type="button" className={estilos.rojo} onClick={() => void sacarA(p)}>
          <Icono nombre="cerrar" medida={18} trazo={2} />
          {t.sacarInvitacion}
        </button>
      </div>
    </>
  )

  // ---------- Computador ----------
  if (esComputador) {
    const lado = () => {
      if (panel === 'invitar') {
        return (
          <>
            <h2 className={estilos.tituloLado}>{invitada ? t.invitasteA(nombre(invitada)) : t.invitarA}</h2>
            {invitada ? listoInvitacion(invitada) : formulario}
          </>
        )
      }
      if (!elegida) return null
      if (panel === 'sacar') {
        return (
          <>
            <Avatar persona={elegida} medida={56} />
            <div className={estilos.nombreLado}>{t.sacarPregunta(primerNombre(elegida))}</div>
            <div className={estilos.explica}>{t.sacarExplica}</div>
            <div className={estilos.botones}>
              <BotonPrincipal peligro onClick={() => void sacarA(elegida)}>{t.sacar}</BotonPrincipal>
              <BotonBorde onClick={cerrar}>{textos.cancelar}</BotonBorde>
            </div>
          </>
        )
      }
      if (!elegida.entro_en) {
        return (
          <>
            <Sobre medida={56} />
            <div className={estilos.nombreLado}>{nombre(elegida)}</div>
            <div className={estilos.datoLado}>{correoCortable(elegida.correo)}</div>
            <div className={estilos.sinEntrar}>{t.sinEntrar}</div>
            <div className={estilos.datoLado}>{invitadoEl(elegida)}</div>
            <div className={estilos.botones}>
              {whatsapp(elegida)}
              <BotonBorde icono="copiar" onClick={copiarEnlace}>{t.copiarEnlace}</BotonBorde>
              <button type="button" className={estilos.rojo} aria-disabled={!conectado} onClick={() => pedirSacar(() => void sacarA(elegida))}>
                <Icono nombre="cerrar" medida={18} trazo={2} />
                {t.sacarInvitacion}
              </button>
            </div>
          </>
        )
      }
      return (
        <>
          <Avatar persona={elegida} medida={56} />
          <div className={estilos.nombreLado}>
            {nombre(elegida)}
            {elegida.id === yo.id && <Marca>{t.tu}</Marca>}
            {elegida.administra && <Marca>{t.admin}</Marca>}
          </div>
          {elegida.carrera && <div className={estilos.carrera}>{carreraCorta(elegida.carrera)}</div>}
          <div className={estilos.datoLado}>{elegida.correo}</div>
          <div className={estilos.botones}>
            <BotonBorde icono="copiar" onClick={() => copiarCorreo(elegida)}>{t.copiarCorreo}</BotonBorde>
            {elegida.id !== yo.id && (
              <button type="button" className={estilos.rojo} aria-disabled={!conectado} onClick={() => pedirSacar(() => setPanel('sacar'))}>
                <Icono nombre="sacar" medida={18} />
                {t.sacar}
              </button>
            )}
          </div>
        </>
      )
    }
    return (
      <div className={escritorio.pantalla}>
        <div className={`${escritorio.cabecera} ${estilos.cabeceraPc}`}>
          <div>
            <button type="button" className={estilos.atrasChico} onClick={() => navigate('/perfil')}>
              <Icono nombre="izquierda" medida={20} trazo={2} />
              {t.tuPerfil}
            </button>
            <h1 className={`${escritorio.titulo} ${estilos.tituloPc}`}>{t.titulo}</h1>
            <div className={escritorio.linea1}>{resumen}</div>
          </div>
          <div className={estilos.acciones}>
            <SinConexion />
            <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscadorPc} />
            <button type="button" className={estilos.invitarPc} aria-disabled={!conectado} onClick={abrirInvitar}>
              <Icono nombre="mas" medida={20} trazo={2.25} />
              {t.invitar}
            </button>
          </div>
        </div>
        <div className={`${escritorio.cuerpo} ${estilos.cuerpoPc}`}>
          <div className={escritorio.columnas}>
            <div className={escritorio.columna}>{lista}</div>
            <aside aria-label={panel === 'invitar' ? t.invitarA : t.elegido} className={`${escritorio.lado} ${estilos.lado}`}>
              {lado()}
            </aside>
          </div>
        </div>
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
      </div>
    )
  }

  // ---------- Celular ----------
  return (
    <div className={estilos.pantalla} data-sin-red={!conectado}>
      <div className={estilos.desplazable}>
        <div className={estilos.volver}>
          <Atras texto={t.tuPerfil} onClick={() => navigate('/perfil')} />
          <SinConexion />
        </div>
        <div className={estilos.titulo}>
          <Titulo>{t.titulo}</Titulo>
        </div>
        <div className={estilos.resumen}>{resumen}</div>
        <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscador} />
        {lista}
      </div>
      <Pie>
        <BotonPrincipal icono="mas" apagado={!conectado} onClick={abrirInvitar}>
          {t.invitar}
        </BotonPrincipal>
        {!conectado && <div className={estilos.nota}>{t.necesitasInvitar}</div>}
      </Pie>
      <Hoja abierta={hoja === 'invitar'} etiqueta={invitada ? t.invitasteA(nombre(invitada)) : t.invitarA} onCerrar={cerrar}>
        <TituloHoja>{invitada ? t.invitasteA(nombre(invitada)) : t.invitarA}</TituloHoja>
        {invitada ? listoInvitacion(invitada) : formulario}
      </Hoja>
      <Hoja abierta={hoja === 'opciones' && elegida !== null} etiqueta={elegida ? nombre(elegida) : ''} onCerrar={cerrar}>
        {elegida && (
          <>
            <div className={estilos.hojaQuien}>
              <Avatar persona={elegida} medida={48} />
              <span className={estilos.quien}>
                <span className={estilos.hojaNombre}>{nombre(elegida)}</span>
                <span className={estilos.correoRecortado} data-chico="true">{elegida.correo}</span>
              </span>
            </div>
            <div className={estilos.hojaOpciones}>
              <button type="button" className={estilos.opcion} onClick={() => copiarCorreo(elegida)}>
                <Icono nombre="copiar" medida={22} />
                {t.copiarCorreo}
              </button>
              <button type="button" className={estilos.opcion} data-peligro="true" onClick={() => pedirSacar(() => setHoja('sacar'))}>
                <Icono nombre="sacar" medida={22} />
                {t.sacar}
              </button>
            </div>
            <div className={estilos.cancelar}>
              <BotonBorde onClick={cerrar}>{textos.cancelar}</BotonBorde>
            </div>
          </>
        )}
      </Hoja>
      <Hoja abierta={hoja === 'sacar' && elegida !== null} etiqueta={t.sacar} alerta onCerrar={cerrar}>
        {elegida && (
          <>
            <TituloHoja>{t.sacarPregunta(primerNombre(elegida))}</TituloHoja>
            <div className={estilos.explica}>{t.sacarExplica}</div>
            <div className={estilos.botones}>
              <BotonPrincipal peligro onClick={() => void sacarA(elegida)}>{t.sacar}</BotonPrincipal>
              <BotonBorde onClick={cerrar}>{textos.cancelar}</BotonBorde>
            </div>
          </>
        )}
      </Hoja>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie />
    </div>
  )
}

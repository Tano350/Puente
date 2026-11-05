import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Atras, Aviso, Bajada, BotonBorde, BotonPrincipal, Fila, FilaInterruptor, Grupo, Hoja, Pie, Titulo, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { secciones } from '../../componentes/secciones.ts'
import { seccionPrevia } from '../../componentes/seccionPrevia.ts'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { DetallePersona, Tarjeta } from '../../componentes/Tarjeta.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import { useConectado } from '../../datos/conexion.ts'
import { conectarCalendario, guardarAccesoAlVolver, useCalendarioConectado } from '../../datos/calendario.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { activarAvisos, esIPhone, estaInstalada, marcarInstalada, pedirInstalar } from '../../datos/dispositivo.ts'
import { rangoCorto } from '../../datos/fechas.ts'
import { useIdioma, type Idioma } from '../../datos/idioma.ts'
import { useSesion, type Persona } from '../../datos/sesion.tsx'
import { useCuantoSinSubir } from '../../datos/sinSenal.ts'
import { cambiarTema, useTema } from '../../datos/tema.ts'
import { useTextos } from '../../textos.ts'
import {
  borradorPerfil,
  guardarPerfil,
  ComoInstalar,
  FormularioFechas,
  FormularioPerfil,
  InterruptoresDeAvisos,
  modoInstalar,
  preferenciasDe,
  useDispositivo,
  useValidarFechas,
  useValidarPerfil,
  type BorradorFechas,
  type ErroresFechas,
  type ErroresPerfil,
  type Preferencias,
} from './formularios.tsx'
import { CalendariosDelViaje } from './CalendariosDelViaje.tsx'
import { elegirIdioma, HojaIdioma, MenuIdioma, nombreDelIdioma } from './Idioma.tsx'
import estilosIdioma from './Idioma.module.css'
import estilos from './TuPerfil.module.css'

type Abierto = 'editar' | 'fechas' | 'avisos' | 'instalar' | 'calendario'

// Cómo se envuelve cada ajuste: pantalla propia en el celular, panel encima en el computador
type Envoltura = { titulo: string; pie?: ReactNode; children: ReactNode }
type Contenedor = (props: Envoltura) => ReactNode

function PanelEncima({ titulo, pie, children, onCerrar }: Envoltura & { onCerrar: () => void }) {
  const textos = useTextos()
  return (
    <aside aria-label={titulo} className={estilos.panel}>
      <div className={estilos.panelCabeza}>
        <h2 className={estilos.panelTitulo}>{titulo}</h2>
        <button type="button" aria-label={textos.cerrar} className={estilos.cerrar} onClick={onCerrar}>
          <Icono nombre="cerrar" medida={20} trazo={2} />
        </button>
      </div>
      {children}
      {pie && <div className={estilos.panelPie}>{pie}</div>}
    </aside>
  )
}

function SubPantalla({ titulo, pie, children, volverA, onVolver }: Envoltura & { volverA: string; onVolver: () => void }) {
  return (
    <div className={estilos.subpantalla}>
      <div className={estilos.desplazable}>
        <div className={estilos.volver}>
          <Atras texto={volverA} onClick={onVolver} />
        </div>
        <div className={estilos.contenido}>
          <Titulo>{titulo}</Titulo>
          {children}
        </div>
      </div>
      {pie && <Pie>{pie}</Pie>}
    </div>
  )
}

function Nota({ texto }: { texto: string | null }) {
  return texto ? <div className={estilos.nota} role="alert">{texto}</div> : null
}

function EditarPerfil({ persona, marco, alTerminar }: { persona: Persona; marco: Contenedor; alTerminar: (aviso?: string) => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const validar = useValidarPerfil()
  const [borrador, setBorrador] = useState(() => borradorPerfil(persona))
  const [errores, setErrores] = useState<ErroresPerfil>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const guardar = async () => {
    const nuevos = validar(borrador)
    setErrores(nuevos)
    if (nuevos.nombre || nuevos.carrera) return
    setGuardando(true)
    setFallo(false)
    try {
      await guardarPerfil(persona, borrador, sesion.actualizar)
      alTerminar(textos.perfil.guardado)
    } catch {
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }
  return marco({
    titulo: textos.perfil.editar,
    pie: (
      <>
        <BotonPrincipal onClick={() => void guardar()} ocupado={guardando}>{textos.guardar}</BotonPrincipal>
        <Nota texto={fallo ? textos.noSeGuardo : null} />
      </>
    ),
    children: <FormularioPerfil persona={persona} borrador={borrador} onCambio={setBorrador} errores={errores} />,
  })
}

function EditarFechas({ persona, marco, alTerminar }: { persona: Persona; marco: Contenedor; alTerminar: (aviso?: string) => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const validar = useValidarFechas()
  const { data: personas = [] } = usePersonas()
  const [borrador, setBorrador] = useState<BorradorFechas>({ llega: persona.llega, vuelve: persona.vuelve })
  const [errores, setErrores] = useState<ErroresFechas>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const guardar = async () => {
    const nuevos = validar(borrador)
    setErrores(nuevos)
    if (nuevos.llega || nuevos.vuelve) return
    setGuardando(true)
    setFallo(false)
    try {
      await sesion.actualizar({ llega: borrador.llega, vuelve: borrador.vuelve })
      alTerminar(textos.fechas.guardado)
    } catch {
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }
  return marco({
    titulo: textos.fechas.titulo,
    pie: (
      <>
        <BotonPrincipal onClick={() => void guardar()} ocupado={guardando}>{textos.guardar}</BotonPrincipal>
        <Nota texto={fallo ? textos.noSeGuardo : null} />
      </>
    ),
    children: <FormularioFechas borrador={borrador} onCambio={setBorrador} errores={errores} otros={personas.filter((p) => p.id !== persona.id)} />,
  })
}

function AjusteAvisos({ persona, activos, marco, alActivar }: { persona: Persona; activos: boolean; marco: Contenedor; alActivar: (aviso: string) => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const [preferencias, setPreferencias] = useState(() => preferenciasDe(persona.avisos))
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  // Con los avisos ya activados, cada interruptor se guarda al tocarlo
  const cambiar = (nuevas: Preferencias) => {
    setPreferencias(nuevas)
    if (activos) void sesion.actualizar({ avisos: nuevas }).catch(() => setProblema(textos.noSeGuardo))
  }
  // En iPhone los avisos solo llegan con la app instalada: hasta entonces, el botón queda apagado
  // (los interruptores ya dicen "Primero instala la app")
  const sinInstalar = esIPhone && !estaInstalada()
  const activar = async () => {
    setOcupado(true)
    setProblema(null)
    try {
      await sesion.actualizar({ avisos: preferencias })
      const resultado = await activarAvisos(persona.id)
      if (resultado === 'activados') alActivar(textos.avisos.activados)
      else setProblema(resultado === 'bloqueados' ? textos.avisos.bloqueados : textos.avisos.sinSoporte)
    } catch {
      setProblema(textos.avisos.noSePudo)
    } finally {
      setOcupado(false)
    }
  }
  return marco({
    titulo: textos.avisos.titulo,
    pie: activos ? undefined : (
      <>
        <BotonPrincipal onClick={() => void activar()} apagado={sinInstalar} ocupado={ocupado}>{textos.avisos.activar}</BotonPrincipal>
        <Nota texto={problema} />
      </>
    ),
    children: (
      <>
        {activos && <div className={estilos.bajada}>{textos.avisos.eligeCorto}</div>}
        <InterruptoresDeAvisos preferencias={preferencias} onCambio={cambiar} />
        {activos && <Nota texto={problema} />}
      </>
    ),
  })
}

function AjusteInstalar({ marco, alInstalar }: { marco: Contenedor; alInstalar: () => void }) {
  const textos = useTextos()
  const [modo] = useState(modoInstalar)
  const instalar = async () => {
    if (modo === 'boton') {
      if (await pedirInstalar()) alInstalar()
      return
    }
    marcarInstalada()
    alInstalar()
  }
  return marco({
    titulo: textos.instalar.titulo,
    pie: <BotonPrincipal onClick={() => void instalar()}>{modo === 'boton' ? textos.instalar.instalar : textos.instalar.yaLaInstale}</BotonPrincipal>,
    children: <ComoInstalar modo={modo} />,
  })
}

// Solo quien administra: conecta su cuenta de Google para los calendarios "The Bridge" (Google vuelve a Tu perfil)
function AjusteCalendario({ conectado, marco }: { conectado: boolean; marco: Contenedor }) {
  const textos = useTextos()
  const t = textos.calendario
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const conectar = async () => {
    setOcupado(true)
    setProblema(null)
    try {
      await conectarCalendario('/perfil')
    } catch {
      setProblema(t.noSeAbrio)
      setOcupado(false)
    }
  }
  const Boton = conectado ? BotonBorde : BotonPrincipal
  return marco({
    titulo: t.titulo,
    pie: (
      <>
        <Boton onClick={() => void conectar()} ocupado={ocupado}>{conectado ? t.volverAConectar : t.conectar}</Boton>
        <Nota texto={problema} />
      </>
    ),
    children: conectado ? (
      <CalendariosDelViaje />
    ) : (
      <>
        <div className={estilos.bajada}>{t.explica}</div>
        <div className={estilos.bajada}>{t.permiso}</div>
      </>
    ),
  })
}

export function TuPerfil() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const esComputador = useEsComputador()
  const dispositivo = useDispositivo()
  const idioma = useIdioma()
  const tema = useTema()
  const hayConexion = useConectado()
  const { data: personas = [] } = usePersonas()
  const aviso = useAviso()
  // Un pendiente de Hoy puede pedir que se abra un ajuste, como "Editar perfil"
  const [abierto, setAbierto] = useState<Abierto | null>(() => (location.state as { abrir?: Abierto } | null)?.abrir ?? null)
  const [confirmarSalir, setConfirmarSalir] = useState(false)
  const [eligiendoIdioma, setEligiendoIdioma] = useState(false)
  // Salir borra lo que no ha subido: si hay algo, la confirmación lo dice
  const pendiente = useCuantoSinSubir()
  const hayPendiente = pendiente.gastos + pendiente.notas + pendiente.otros > 0
  const { data: conectado = false } = useCalendarioConectado(sesion.tipo === 'dentro' && sesion.persona.administra)
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])
  // Al volver de Google después de conectar el calendario
  useEffect(() => {
    guardarAccesoAlVolver()
      .then((resultado) => {
        if (resultado === 'conectado') aviso.mostrar(textos.calendario.conectaste)
        if (resultado === 'sinPermiso') aviso.mostrar(textos.calendario.sinPermiso)
      })
      .catch(() => aviso.mostrar(textos.noSeGuardo))
    // Solo al abrir Tu perfil
  }, [])
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const t = textos.perfil

  const activos = personas.filter((p) => !p.sacada_en)
  const entraron = activos.filter((p) => p.entro_en).length
  const cerrar = (texto?: string) => {
    setAbierto(null)
    if (texto) aviso.mostrar(texto)
  }

  // Cambiar el perfil necesita conexión; el idioma, el modo oscuro y la instalación no
  const abrir = (ajuste: Abierto) => (hayConexion ? setAbierto(ajuste) : aviso.mostrar(t.necesitaConexion))
  const elegir = (nuevo: Idioma) => {
    const texto = elegirIdioma(nuevo, idioma, sesion.actualizar, t.idiomaCambiado)
    setEligiendoIdioma(false)
    if (texto) aviso.mostrar(texto)
  }

  // Sin señal, las filas que necesitan conexión salen atenuadas (y al tocarlas dicen por qué); Idioma, Modo oscuro e Instalar siguen normales
  const fila = (contenido: ReactNode, necesitaConexion = false) => (
    <div className={estilos.fila} data-sin-red={necesitaConexion && !hayConexion}>
      {contenido}
    </div>
  )
  const filas = (
    <>
      {fila(<Fila etiqueta={textos.fechas.titulo} valor={persona.llega && persona.vuelve ? rangoCorto(persona.llega, persona.vuelve) : t.falta} onClick={() => abrir('fechas')} />, true)}
      {fila(<Fila etiqueta={t.idioma} valor={nombreDelIdioma(idioma)} onClick={() => setEligiendoIdioma((abierta) => !abierta)} />)}
      {/* Solo en este dispositivo, como el teléfono: se puede querer claro en uno y oscuro en otro */}
      {fila(<FilaInterruptor etiqueta={t.modoOscuro} activo={tema === 'oscuro'} onCambio={(oscuro) => cambiarTema(oscuro ? 'oscuro' : 'claro')} />)}
      {fila(<Fila etiqueta={textos.avisos.titulo} valor={dispositivo.avisos ? t.activados : t.apagados} onClick={() => abrir('avisos')} />, true)}
      {!dispositivo.instalada && fila(<Fila etiqueta={textos.primeraVez.tareas.instalar} onClick={() => setAbierto('instalar')} />)}
      {persona.administra &&
        fila(<Fila etiqueta={t.invitados} valor={t.yaEntraron(entraron, activos.length)} onClick={() => (hayConexion ? navigate('/perfil/invitados') : aviso.mostrar(t.necesitaConexion))} />, true)}
      {persona.administra &&
        fila(<Fila etiqueta={textos.calendario.titulo} valor={conectado ? textos.calendario.conectado : textos.calendario.sinConectar} onClick={() => abrir('calendario')} />, true)}
    </>
  )

  const ajuste = (marco: Contenedor) => {
    if (abierto === 'editar') return <EditarPerfil persona={persona} marco={marco} alTerminar={cerrar} />
    if (abierto === 'fechas') return <EditarFechas persona={persona} marco={marco} alTerminar={cerrar} />
    if (abierto === 'avisos') return <AjusteAvisos persona={persona} activos={dispositivo.avisos} marco={marco} alActivar={(texto) => { dispositivo.setAvisos(true); cerrar(texto) }} />
    if (abierto === 'instalar') return <AjusteInstalar marco={marco} alInstalar={() => { dispositivo.setInstalada(true); cerrar() }} />
    if (abierto === 'calendario') return <AjusteCalendario conectado={conectado} marco={marco} />
    return null
  }

  if (esComputador) {
    return (
      <div className={estilos.escritorio}>
        <h1 className={estilos.tituloEscritorio}>{t.titulo}</h1>
        <div className={estilos.cuerpo}>
          <div className={estilos.columnas}>
            <div className={estilos.ajustes}>
              <div className={estilosIdioma.ancla}>
                <Grupo arriba={52}>{filas}</Grupo>
                {eligiendoIdioma && <MenuIdioma alElegir={elegir} onCerrar={() => setEligiendoIdioma(false)} />}
              </div>
              <div className={estilos.salir}>
                {confirmarSalir ? (
                  <div className={estilos.confirmar}>
                    <div className={estilos.confirmarTitulo}>{t.salirPregunta}</div>
                    {hayPendiente && <div className={estilos.bajada}>{t.salirPendiente(pendiente.gastos, pendiente.notas, pendiente.otros)}</div>}
                    <div className={estilos.confirmarBotones}>
                      <button type="button" className={estilos.chicoPrincipal} onClick={() => void sesion.salir()}>{hayPendiente ? t.salirIgual : textos.salir}</button>
                      <button type="button" className={estilos.chicoBorde} onClick={() => setConfirmarSalir(false)}>{textos.cancelar}</button>
                    </div>
                  </div>
                ) : (
                  <Fila etiqueta={textos.salir} sinFlecha onClick={() => setConfirmarSalir(true)} />
                )}
              </div>
            </div>
            <aside aria-label={t.tuTarjeta} className={estilos.lado}>
              <div className={estilos.editarFila}>
                {hayConexion ? (
                  <button type="button" className={estilos.editarBorde} onClick={() => setAbierto('editar')}>
                    <Icono nombre="lapiz" medida={18} />
                    {t.editarCorto}
                  </button>
                ) : (
                  <SinConexion />
                )}
              </div>
              <Tarjeta persona={persona} />
              <DetallePersona persona={persona} />
            </aside>
          </div>
          {ajuste((props) => <PanelEncima {...props} onCerrar={() => setAbierto(null)} />)}
        </div>
        <Aviso texto={aviso.texto} />
      </div>
    )
  }

  // Celular: cada ajuste es una pantalla propia, con "Tu perfil" para volver
  if (abierto) return ajuste((props) => <SubPantalla {...props} volverA={t.titulo} onVolver={() => setAbierto(null)} />)

  // "Volver" regresa a la sección desde donde se abrió Tu perfil (Hoy, Grupo…) y lo dice
  const previa = seccionPrevia()
  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <Atras texto={textos.secciones[previa]} onClick={() => navigate(secciones.find((s) => s.clave === previa)?.ruta ?? '/hoy')} />
        {hayConexion ? (
          <button type="button" className={estilos.editar} onClick={() => setAbierto('editar')}>
            <Icono nombre="lapiz" medida={18} />
            {t.editarCorto}
          </button>
        ) : (
          <SinConexion />
        )}
      </div>
      <div className={estilos.titulo}>
        <Titulo>{t.titulo}</Titulo>
      </div>
      <Tarjeta persona={persona} />
      <Grupo arriba={24}>{filas}</Grupo>
      <Grupo arriba={16}>
        <Fila etiqueta={textos.salir} sinFlecha onClick={() => setConfirmarSalir(true)} />
      </Grupo>
      <HojaIdioma abierta={eligiendoIdioma} alElegir={elegir} onCerrar={() => setEligiendoIdioma(false)} />
      <Hoja abierta={confirmarSalir} etiqueta={t.salirPregunta} alerta onCerrar={() => setConfirmarSalir(false)}>
        <TituloHoja>{t.salirPregunta}</TituloHoja>
        {hayPendiente && <Bajada>{t.salirPendiente(pendiente.gastos, pendiente.notas, pendiente.otros)}</Bajada>}
        <div className={estilos.hojaBotones}>
          <BotonPrincipal onClick={() => void sesion.salir()}>{hayPendiente ? t.salirIgual : textos.salir}</BotonPrincipal>
          <BotonBorde onClick={() => setConfirmarSalir(false)}>{textos.cancelar}</BotonBorde>
        </div>
      </Hoja>
      <Aviso texto={aviso.texto} />
    </div>
  )
}

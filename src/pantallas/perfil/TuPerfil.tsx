import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Atras, Aviso, BotonBorde, BotonPrincipal, Fila, Grupo, Hoja, Pie, Titulo, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { DetallePersona, Tarjeta } from '../../componentes/Tarjeta.tsx'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { activarAvisos, marcarInstalada, pedirInstalar } from '../../datos/dispositivo.ts'
import { rangoCorto } from '../../datos/fechas.ts'
import { useSesion, type Persona } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import {
  borradorPerfil,
  cambiosDePerfil,
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
import estilos from './TuPerfil.module.css'

type Abierto = 'editar' | 'fechas' | 'avisos' | 'instalar'

// Cómo se envuelve cada ajuste: pantalla propia en el celular, panel encima en el computador
type Envoltura = { titulo: string; pie?: ReactNode; children: ReactNode }
type Contenedor = (props: Envoltura) => ReactNode

function PanelEncima({ titulo, pie, children, onCerrar }: Envoltura & { onCerrar: () => void }) {
  return (
    <aside aria-label={titulo} className={estilos.panel}>
      <div className={estilos.panelCabeza}>
        <h2 className={estilos.panelTitulo}>{titulo}</h2>
        <button type="button" aria-label="Cerrar" className={estilos.cerrar} onClick={onCerrar}>
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

function useAvisoTemporal() {
  const [texto, setTexto] = useState<string | null>(null)
  const reloj = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(reloj.current), [])
  const mostrar = (nuevo: string) => {
    setTexto(nuevo)
    window.clearTimeout(reloj.current)
    reloj.current = window.setTimeout(() => setTexto(null), 4000)
  }
  return { texto, mostrar }
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
      await sesion.actualizar(cambiosDePerfil(borrador))
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
        <BotonPrincipal onClick={() => void activar()} ocupado={ocupado}>{textos.avisos.activar}</BotonPrincipal>
        <Nota texto={problema} />
      </>
    ),
    children: (
      <>
        <div className={estilos.bajada}>{textos.avisos.eligeCorto}</div>
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

export function TuPerfil() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const esComputador = useEsComputador()
  const dispositivo = useDispositivo()
  const { data: personas = [] } = usePersonas()
  const aviso = useAvisoTemporal()
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [confirmarSalir, setConfirmarSalir] = useState(false)
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const t = textos.perfil

  const activos = personas.filter((p) => !p.sacada_en)
  const entraron = activos.filter((p) => p.entro_en).length
  const cerrar = (texto?: string) => {
    setAbierto(null)
    if (texto) aviso.mostrar(texto)
  }

  const filas = (
    <>
      <Fila etiqueta={textos.fechas.titulo} valor={persona.llega && persona.vuelve ? rangoCorto(persona.llega, persona.vuelve) : t.falta} onClick={() => setAbierto('fechas')} />
      <Fila etiqueta={textos.avisos.titulo} valor={dispositivo.avisos ? t.activados : t.apagados} onClick={() => setAbierto('avisos')} />
      {!dispositivo.instalada && <Fila etiqueta={textos.primeraVez.tareas.instalar} onClick={() => setAbierto('instalar')} />}
      {persona.administra && <Fila etiqueta={t.invitados} valor={t.deTotal(entraron, activos.length)} onClick={() => navigate('/perfil/invitados')} />}
    </>
  )

  const ajuste = (marco: Contenedor) => {
    if (abierto === 'editar') return <EditarPerfil persona={persona} marco={marco} alTerminar={cerrar} />
    if (abierto === 'fechas') return <EditarFechas persona={persona} marco={marco} alTerminar={cerrar} />
    if (abierto === 'avisos') return <AjusteAvisos persona={persona} activos={dispositivo.avisos} marco={marco} alActivar={(texto) => { dispositivo.setAvisos(true); cerrar(texto) }} />
    if (abierto === 'instalar') return <AjusteInstalar marco={marco} alInstalar={() => { dispositivo.setInstalada(true); cerrar() }} />
    return null
  }

  if (esComputador) {
    return (
      <div className={estilos.escritorio}>
        <h1 className={estilos.tituloEscritorio}>{t.titulo}</h1>
        <div className={estilos.cuerpo}>
          <div className={estilos.columnas}>
            <div className={estilos.ajustes}>
              <Grupo arriba={52}>{filas}</Grupo>
              <div className={estilos.salir}>
                {confirmarSalir ? (
                  <div className={estilos.confirmar}>
                    <div className={estilos.confirmarTitulo}>{t.salirPregunta}</div>
                    <div className={estilos.confirmarBotones}>
                      <button type="button" className={estilos.chicoPrincipal} onClick={() => void sesion.salir()}>{textos.salir}</button>
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
                <button type="button" className={estilos.editarBorde} onClick={() => setAbierto('editar')}>
                  <Icono nombre="lapiz" medida={18} />
                  {t.editarCorto}
                </button>
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

  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <Atras texto={t.grupo} onClick={() => navigate('/grupo')} />
        <button type="button" className={estilos.editar} onClick={() => setAbierto('editar')}>
          <Icono nombre="lapiz" medida={18} />
          {t.editarCorto}
        </button>
      </div>
      <Tarjeta persona={persona} />
      <Grupo arriba={24}>{filas}</Grupo>
      <Grupo arriba={16}>
        <Fila etiqueta={textos.salir} sinFlecha onClick={() => setConfirmarSalir(true)} />
      </Grupo>
      <Hoja abierta={confirmarSalir} etiqueta={t.salirPregunta} alerta onCerrar={() => setConfirmarSalir(false)}>
        <TituloHoja>{t.salirPregunta}</TituloHoja>
        <div className={estilos.hojaBotones}>
          <BotonPrincipal onClick={() => void sesion.salir()}>{textos.salir}</BotonPrincipal>
          <BotonBorde onClick={() => setConfirmarSalir(false)}>{textos.cancelar}</BotonBorde>
        </div>
      </Hoja>
      <Aviso texto={aviso.texto} />
    </div>
  )
}

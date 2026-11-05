import { useEffect, useState, type ReactNode } from 'react'
import { Atras, BotonBorde, BotonPrincipal, Pie, Titulo } from '../componentes/Controles.tsx'
import { Icono } from '../componentes/Icono.tsx'
import { conectarCalendario, guardarAccesoAlVolver, useCalendarioConectado } from '../datos/calendario.ts'
import { usePersonas } from '../datos/consultas.ts'
import { activarAvisos, esIPhone, estaInstalada, marcarInstalada, pedirInstalar } from '../datos/dispositivo.ts'
import { primerNombre } from '../datos/nombres.ts'
import { useSesion, type Persona } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import {
  borradorPerfil,
  guardarPerfil,
  ComoInstalar,
  FormularioFechas,
  FormularioPerfil,
  InterruptoresDeAvisos,
  modoInstalar,
  perfilCompleto,
  preferenciasDe,
  useDispositivo,
  useValidarFechas,
  useValidarPerfil,
  type BorradorFechas,
  type ErroresFechas,
  type ErroresPerfil,
} from './perfil/formularios.tsx'
import estilos from './PrimeraVez.module.css'

type Paso = 'lista' | 'perfil' | 'fechas' | 'instalar' | 'avisos' | 'calendario'
type Tarea = Exclude<Paso, 'lista'>

// Pantalla de un paso: "Volver" arriba, el contenido y el botón fijo abajo
function PantallaPaso({ alVolver, pie, children }: { alVolver?: () => void; pie: ReactNode; children: ReactNode }) {
  const textos = useTextos()
  return (
    <div className={estilos.pantalla}>
      <div className={estilos.desplazable}>
        {alVolver && (
          <div className={estilos.volver}>
            <Atras texto={textos.volver} onClick={alVolver} />
          </div>
        )}
        <div className={estilos.contenido}>{children}</div>
      </div>
      <Pie>{pie}</Pie>
    </div>
  )
}

function NoSeGuardo({ visible }: { visible: boolean }) {
  const textos = useTextos()
  return visible ? <div className={estilos.nota} role="alert">{textos.noSeGuardo}</div> : null
}

function PasoPerfil({ persona, alTerminar }: { persona: Persona; alTerminar: () => void }) {
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
      alTerminar()
    } catch {
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <PantallaPaso alVolver={alTerminar} pie={<><BotonPrincipal onClick={() => void guardar()} ocupado={guardando}>{textos.guardar}</BotonPrincipal><NoSeGuardo visible={fallo} /></>}>
      <Titulo>{textos.perfil.titulo}</Titulo>
      <FormularioPerfil persona={persona} borrador={borrador} onCambio={setBorrador} errores={errores} />
    </PantallaPaso>
  )
}

function PasoFechas({ persona, alTerminar }: { persona: Persona; alTerminar: () => void }) {
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
      alTerminar()
    } catch {
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <PantallaPaso alVolver={alTerminar} pie={<><BotonPrincipal onClick={() => void guardar()} ocupado={guardando}>{textos.guardar}</BotonPrincipal><NoSeGuardo visible={fallo} /></>}>
      <Titulo>{textos.fechas.titulo}</Titulo>
      <FormularioFechas borrador={borrador} onCambio={setBorrador} errores={errores} otros={personas.filter((p) => p.id !== persona.id)} />
    </PantallaPaso>
  )
}

function PasoInstalar({ alTerminar, alInstalar }: { alTerminar: () => void; alInstalar: () => void }) {
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
  return (
    <PantallaPaso alVolver={alTerminar} pie={<BotonPrincipal onClick={() => void instalar()}>{modo === 'boton' ? textos.instalar.instalar : textos.instalar.yaLaInstale}</BotonPrincipal>}>
      <Titulo>{textos.instalar.titulo}</Titulo>
      <ComoInstalar modo={modo} />
    </PantallaPaso>
  )
}

function PasoAvisos({ persona, alTerminar, alActivar }: { persona: Persona; alTerminar: () => void; alActivar: () => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const [preferencias, setPreferencias] = useState(() => preferenciasDe(persona.avisos))
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  // En iPhone los avisos solo llegan con la app instalada: hasta entonces, el botón queda apagado
  const sinInstalar = esIPhone && !estaInstalada()
  const activar = async () => {
    setOcupado(true)
    setProblema(null)
    try {
      await sesion.actualizar({ avisos: preferencias })
      const resultado = await activarAvisos(persona.id)
      if (resultado === 'activados') alActivar()
      else setProblema(resultado === 'bloqueados' ? textos.avisos.bloqueados : textos.avisos.sinSoporte)
    } catch {
      setProblema(textos.avisos.noSePudo)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <PantallaPaso alVolver={alTerminar} pie={<><BotonPrincipal onClick={() => void activar()} apagado={sinInstalar} ocupado={ocupado}>{textos.avisos.activar}</BotonPrincipal>{problema && <div className={estilos.nota} role="alert">{problema}</div>}</>}>
      <Titulo>{textos.avisos.titulo}</Titulo>
      <InterruptoresDeAvisos preferencias={preferencias} onCambio={setPreferencias} />
    </PantallaPaso>
  )
}

// Solo quien administra: conecta su cuenta de Google para los calendarios "The Bridge" (Google vuelve aquí)
function PasoCalendario({ conectado, problemaAlVolver, alTerminar }: { conectado: boolean; problemaAlVolver: string | null; alTerminar: () => void }) {
  const textos = useTextos()
  const t = textos.calendario
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState(problemaAlVolver)
  const conectar = async () => {
    setOcupado(true)
    setProblema(null)
    try {
      await conectarCalendario('/hoy')
    } catch {
      setProblema(t.noSeAbrio)
      setOcupado(false)
    }
  }
  const Boton = conectado ? BotonBorde : BotonPrincipal
  return (
    <PantallaPaso alVolver={alTerminar} pie={<><Boton onClick={() => void conectar()} ocupado={ocupado}>{conectado ? t.volverAConectar : t.conectar}</Boton>{problema && <div className={estilos.nota} role="alert">{problema}</div>}</>}>
      <Titulo>{t.titulo}</Titulo>
      <div className={estilos.bajada}>{textos.primeraVez.calendario}</div>
    </PantallaPaso>
  )
}

// La lista de tareas de la primera vez: perfil y fechas son obligatorios; instalar, avisos y (para quien administra)
// Google Calendar, recomendados
export function PrimeraVez() {
  const textos = useTextos()
  const sesion = useSesion()
  const dispositivo = useDispositivo()
  const [paso, setPaso] = useState<Paso>('lista')
  const [entrando, setEntrando] = useState(false)
  const { data: conectado = false } = useCalendarioConectado(sesion.tipo === 'dentro' && sesion.persona.administra)
  const [problemaCalendario, setProblemaCalendario] = useState<string | null>(null)
  // Al volver de Google después de conectar el calendario: si salió bien, la tarea queda hecha; si no, se abre con el motivo
  useEffect(() => {
    guardarAccesoAlVolver()
      .then((resultado) => {
        if (resultado !== 'sinPermiso') return
        setProblemaCalendario(textos.calendario.sinPermiso)
        setPaso('calendario')
      })
      .catch(() => {
        setProblemaCalendario(textos.noSeGuardo)
        setPaso('calendario')
      })
    // Solo al abrir la bienvenida
  }, [])
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const volver = () => setPaso('lista')

  if (paso === 'perfil') return <PasoPerfil persona={persona} alTerminar={volver} />
  if (paso === 'fechas') return <PasoFechas persona={persona} alTerminar={volver} />
  if (paso === 'instalar') return <PasoInstalar alTerminar={volver} alInstalar={() => { dispositivo.setInstalada(true); volver() }} />
  if (paso === 'avisos') return <PasoAvisos persona={persona} alTerminar={volver} alActivar={() => { dispositivo.setAvisos(true); volver() }} />
  if (paso === 'calendario') return <PasoCalendario conectado={conectado} problemaAlVolver={problemaCalendario} alTerminar={volver} />

  const t = textos.primeraVez
  const hechas: Record<Tarea, boolean> = {
    perfil: perfilCompleto(persona),
    fechas: Boolean(persona.llega && persona.vuelve),
    instalar: dispositivo.instalada,
    avisos: dispositivo.avisos,
    calendario: conectado,
  }
  const puedeEntrar = hechas.perfil && hechas.fechas
  // Solo lo obligatorio cuenta como lo que falta
  const faltan = (['perfil', 'fechas'] as const).filter((clave) => !hechas[clave])
  // En iPhone los avisos piden primero la app instalada
  const avisosSinInstalar = esIPhone && !hechas.instalar
  const nombre = primerNombre(persona)
  const tareas: { clave: Tarea; pendiente: string }[] = [
    { clave: 'perfil', pendiente: t.falta },
    { clave: 'fechas', pendiente: t.falta },
    { clave: 'instalar', pendiente: t.recomendado },
    { clave: 'avisos', pendiente: avisosSinInstalar ? t.primeroInstalar : t.recomendado },
    ...(persona.administra ? [{ clave: 'calendario' as const, pendiente: t.recomendado }] : []),
  ]
  const irAHoy = async () => {
    setEntrando(true)
    try {
      await sesion.actualizar({ bienvenida_en: new Date().toISOString() })
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className={estilos.pantalla}>
      <div className={estilos.desplazable}>
        <div className={estilos.lista}>
          <Titulo grande>{puedeEntrar ? t.listo(nombre) : t.hola(nombre)}</Titulo>
          {!puedeEntrar && <div className={estilos.faltan}>{t.faltanParaEntrar(faltan.map((clave) => t.faltaParte[clave]))}</div>}
          <div className={estilos.tareas}>
            {tareas.map(({ clave, pendiente }) => (
              <button key={clave} type="button" className={estilos.tarea} onClick={() => setPaso(clave)}>
                {hechas[clave] ? (
                  <span aria-hidden="true" className={estilos.hecha}>
                    <Icono nombre="check" medida={18} trazo={3} />
                  </span>
                ) : (
                  <span aria-hidden="true" className={estilos.pendiente}>
                    <span />
                  </span>
                )}
                <span className={estilos.tareaTexto}>
                  <span className={estilos.tareaTitulo}>{t.tareas[clave]}</span>
                  <span className={estilos.tareaEstado}>{hechas[clave] ? t.hecho : pendiente}</span>
                </span>
                <span className={estilos.flecha}>
                  <Icono nombre="derecha" medida={18} trazo={2} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <Pie>
        {/* Apagado mientras falte algo: el motivo está arriba, en "Para entrar falta" */}
        <div className={estilos.entrar}>
          <BotonPrincipal onClick={() => void irAHoy()} apagado={!puedeEntrar} ocupado={entrando}>
            {t.irAHoy}
          </BotonPrincipal>
        </div>
      </Pie>
    </div>
  )
}

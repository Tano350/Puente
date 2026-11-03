import { useState, type ReactNode } from 'react'
import { Atras, BotonPrincipal, Pie, Titulo } from '../componentes/Controles.tsx'
import { Icono } from '../componentes/Icono.tsx'
import { usePersonas } from '../datos/consultas.ts'
import { activarAvisos, marcarInstalada, pedirInstalar } from '../datos/dispositivo.ts'
import { primerNombre } from '../datos/nombres.ts'
import { useSesion, type Persona } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import {
  borradorPerfil,
  cambiosDePerfil,
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

type Paso = 'lista' | 'perfil' | 'fechas' | 'instalar' | 'avisos'

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
      await sesion.actualizar(cambiosDePerfil(borrador))
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
    <PantallaPaso alVolver={alTerminar} pie={<><BotonPrincipal onClick={() => void activar()} ocupado={ocupado}>{textos.avisos.activar}</BotonPrincipal>{problema && <div className={estilos.nota} role="alert">{problema}</div>}</>}>
      <Titulo>{textos.avisos.titulo}</Titulo>
      <div className={estilos.bajada}>{textos.avisos.elige}</div>
      <InterruptoresDeAvisos preferencias={preferencias} onCambio={setPreferencias} />
    </PantallaPaso>
  )
}

// La lista de tareas de la primera vez: perfil y fechas son obligatorios; instalar y avisos, recomendados
export function PrimeraVez() {
  const textos = useTextos()
  const sesion = useSesion()
  const dispositivo = useDispositivo()
  const [paso, setPaso] = useState<Paso>('lista')
  const [entrando, setEntrando] = useState(false)
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const volver = () => setPaso('lista')

  if (paso === 'perfil') return <PasoPerfil persona={persona} alTerminar={volver} />
  if (paso === 'fechas') return <PasoFechas persona={persona} alTerminar={volver} />
  if (paso === 'instalar') return <PasoInstalar alTerminar={volver} alInstalar={() => { dispositivo.setInstalada(true); volver() }} />
  if (paso === 'avisos') return <PasoAvisos persona={persona} alTerminar={volver} alActivar={() => { dispositivo.setAvisos(true); volver() }} />

  const t = textos.primeraVez
  const hechas = { perfil: perfilCompleto(persona), fechas: Boolean(persona.llega && persona.vuelve), instalar: dispositivo.instalada, avisos: dispositivo.avisos }
  const faltan = Object.values(hechas).filter((hecha) => !hecha).length
  const puedeEntrar = hechas.perfil && hechas.fechas
  const nombre = primerNombre(persona)
  const tareas = [
    { clave: 'perfil', pendiente: t.falta },
    { clave: 'fechas', pendiente: t.falta },
    { clave: 'instalar', pendiente: t.recomendado },
    { clave: 'avisos', pendiente: t.recomendado },
  ] as const
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
          <Titulo grande>{faltan === 0 ? t.listo(nombre) : t.hola(nombre)}</Titulo>
          {faltan > 0 && <div className={estilos.faltan}>{t.faltan(faltan)}</div>}
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
        <BotonPrincipal onClick={() => void irAHoy()} apagado={!puedeEntrar} ocupado={entrando}>
          {t.irAHoy}
        </BotonPrincipal>
        {!puedeEntrar && <div className={estilos.nota}>{hechas.perfil ? t.primeroFechas : t.primeroPerfil}</div>}
      </Pie>
    </div>
  )
}

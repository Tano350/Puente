import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Bajada, CampoFecha, CampoTexto, ErrorCampo, Etiqueta, Interruptor } from '../../componentes/Controles.tsx'
import { Histograma } from '../../componentes/Histograma.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { Tuerca } from '../../componentes/Tuerca.tsx'
import type { Json } from '../../datos/base.ts'
import type { Persona } from '../../datos/consultas.ts'
import { avisosActivos, esIPhone, esSafari, estaInstalada, sePuedePedirInstalar } from '../../datos/dispositivo.ts'
import { diasEntre, VIAJE, ventanaDelViaje } from '../../datos/fechas.ts'
import { limpiarFotos, subirFoto } from '../../datos/fotos.ts'
import type { CambiosDePersona } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { FotoDePerfil } from './FotoDePerfil.tsx'
import estilos from './formularios.module.css'

// Formularios que comparten Primera vez y Tu perfil.

// Solo hay dos carreras. Se guardan tal cual, en español, también con la app en inglés (son datos, no textos)
export const CARRERAS = ['Ingeniería Comercial', 'Ingeniería Civil'] as const

// ---------- Perfil ----------
// La foto es la que se muestra (la de Google, una propia o ninguna); una foto recién elegida se sube al guardar
export type BorradorPerfil = { nombre: string; carrera: string; emprendimiento: string; emprendimiento_texto: string; objetivos: string; linkedin: string; foto: string | null; fotoNueva: Blob | null }
export type ErroresPerfil = { nombre?: string; carrera?: string }

export function borradorPerfil(persona: Persona): BorradorPerfil {
  return {
    nombre: persona.nombre ?? '',
    carrera: persona.carrera ?? '',
    emprendimiento: persona.emprendimiento ?? '',
    emprendimiento_texto: persona.emprendimiento_texto ?? '',
    objetivos: persona.objetivos ?? '',
    linkedin: persona.linkedin ?? '',
    foto: persona.foto,
    fotoNueva: null,
  }
}

export function perfilCompleto(persona: Pick<Persona, 'nombre' | 'carrera'>): boolean {
  return Boolean(persona.nombre?.trim() && persona.carrera?.trim())
}

export function useValidarPerfil() {
  const { perfil: textos } = useTextos()
  return (b: BorradorPerfil): ErroresPerfil => ({
    nombre: b.nombre.trim() ? undefined : textos.faltaNombre,
    carrera: b.carrera.trim() ? undefined : textos.faltaCarrera,
  })
}

export function cambiosDePerfil(b: BorradorPerfil): CambiosDePersona {
  const limpio = (texto: string) => texto.trim() || null
  return {
    nombre: b.nombre.trim(),
    carrera: b.carrera.trim(),
    emprendimiento: limpio(b.emprendimiento),
    emprendimiento_texto: limpio(b.emprendimiento_texto),
    objetivos: limpio(b.objetivos),
    linkedin: limpio(b.linkedin),
  }
}

// Guarda el perfil; si eligió una foto nueva, primero la sube. Después borra las fotos propias que ya no usa.
export async function guardarPerfil(persona: Persona, b: BorradorPerfil, actualizar: (cambios: CambiosDePersona) => Promise<void>): Promise<void> {
  const cambios = cambiosDePerfil(b)
  if (b.fotoNueva) cambios.foto = await subirFoto(persona.id, b.fotoNueva)
  else if (b.foto !== persona.foto) cambios.foto = b.foto
  await actualizar(cambios)
  if (cambios.foto !== undefined) void limpiarFotos(persona.id, cambios.foto).catch(() => undefined)
}

export function FormularioPerfil({ persona, borrador, onCambio, errores }: { persona: Persona; borrador: BorradorPerfil; onCambio: (b: BorradorPerfil) => void; errores: ErroresPerfil }) {
  const { perfil: textos } = useTextos()
  const poner = (campo: keyof BorradorPerfil) => (valor: string) => onCambio({ ...borrador, [campo]: valor })
  return (
    <>
      <FotoDePerfil persona={persona} foto={borrador.foto} fotoNueva={borrador.fotoNueva} onCambio={(cambio) => onCambio({ ...borrador, ...cambio })} />
      <Etiqueta texto={textos.nombre} para="perfil-nombre" />
      <CampoTexto id="perfil-nombre" valor={borrador.nombre} onCambio={poner('nombre')} error={errores.nombre} autoComplete="name" />
      <div id="perfil-carrera-etiqueta" className={estilos.etiquetaGrupo}>
        {textos.carrera}
      </div>
      <div role="radiogroup" aria-labelledby="perfil-carrera-etiqueta" aria-describedby={errores.carrera ? 'perfil-carrera-error' : undefined} aria-invalid={Boolean(errores.carrera)} className={`${estilos.carreras} ${errores.carrera ? estilos.carrerasMal : ''}`}>
        {CARRERAS.map((c) => (
          <label key={c} className={estilos.carrera}>
            <input type="radio" name="perfil-carrera" value={c} checked={borrador.carrera === c} className={estilos.radio} onChange={() => poner('carrera')(c)} />
            {c}
          </label>
        ))}
      </div>
      <ErrorCampo texto={errores.carrera} id="perfil-carrera-error" />
      <Etiqueta texto={textos.emprendimiento} opcional para="perfil-emprendimiento" />
      <CampoTexto id="perfil-emprendimiento" valor={borrador.emprendimiento} onCambio={poner('emprendimiento')} />
      <div className={estilos.queHace}>
        <CampoTexto id="perfil-que-hace" valor={borrador.emprendimiento_texto} onCambio={poner('emprendimiento_texto')} multilinea placeholder={textos.queHace} />
      </div>
      <Etiqueta texto={textos.objetivos} opcional para="perfil-objetivos" />
      <CampoTexto id="perfil-objetivos" valor={borrador.objetivos} onCambio={poner('objetivos')} multilinea />
      <Etiqueta texto={textos.linkedin} opcional para="perfil-linkedin" />
      <CampoTexto id="perfil-linkedin" valor={borrador.linkedin} onCambio={poner('linkedin')} inputMode="url" placeholder="linkedin.com/in/…" autoComplete="url" />
    </>
  )
}

// ---------- Fechas ----------
export type BorradorFechas = { llega: string | null; vuelve: string | null }
export type ErroresFechas = { llega?: string; vuelve?: string }

export function useValidarFechas() {
  const { fechas: textos } = useTextos()
  return (b: BorradorFechas): ErroresFechas => ({
    llega: b.llega ? undefined : textos.faltaLlegada,
    vuelve: !b.vuelve ? textos.faltaVuelta : b.llega && b.vuelve < b.llega ? textos.alReves : undefined,
  })
}

// El calendario nativo abre en el mes de la fecha que tiene el campo, y vacío abre en el mes de hoy. Sin poner ningún
// límite, justo antes de abrirlo se le da al campo (sin avisarle a React) un día de referencia: el que ya eligió la
// persona o el comienzo del viaje. Lo que se ve y se guarda sale del estado, no de ese valor.
const ponerValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
function abrirEn(referencia: string) {
  return (e: SyntheticEvent) => {
    const campo = e.target
    if (campo instanceof HTMLInputElement && campo.type === 'date' && !campo.value) ponerValor.call(campo, referencia)
  }
}

export function FormularioFechas({ borrador, onCambio, errores, otros }: { borrador: BorradorFechas; onCambio: (b: BorradorFechas) => void; errores: ErroresFechas; otros: Persona[] }) {
  const { fechas: textos } = useTextos()
  const dias = borrador.llega && borrador.vuelve && borrador.vuelve >= borrador.llega ? diasEntre(borrador.llega, borrador.vuelve) : null
  return (
    <>
      <div className={estilos.fechas}>
        <div onFocusCapture={abrirEn(VIAJE.desde)} onClickCapture={abrirEn(VIAJE.desde)}>
          <CampoFecha id="fecha-llega" etiqueta={textos.llegas} valor={borrador.llega} onCambio={(llega) => onCambio({ ...borrador, llega })} error={errores.llega} />
        </div>
        <div onFocusCapture={abrirEn(borrador.llega ?? VIAJE.desde)} onClickCapture={abrirEn(borrador.llega ?? VIAJE.desde)}>
          <CampoFecha id="fecha-vuelve" etiqueta={textos.vuelves} valor={borrador.vuelve} min={borrador.llega ?? undefined} onCambio={(vuelve) => onCambio({ ...borrador, vuelve })} error={errores.vuelve} />
        </div>
      </div>
      {dias && <div className={estilos.dias}>{textos.dias(dias)}</div>}
      <div className={estilos.tituloGrafico}>{textos.tituloGrafico}</div>
      <Histograma otros={otros} llega={borrador.llega} vuelve={borrador.vuelve} ventana={ventanaDelViaje([...otros, borrador])} />
    </>
  )
}

// ---------- Avisos ----------
export const TIPOS_DE_AVISO = ['eventos', 'cambios', 'espera', 'recordatorio', 'contacto', 'pago'] as const
export type Preferencias = Record<(typeof TIPOS_DE_AVISO)[number], boolean>

export function preferenciasDe(avisos: Json): Preferencias {
  const guardadas = (avisos && typeof avisos === 'object' && !Array.isArray(avisos) ? avisos : {}) as Record<string, Json>
  return Object.fromEntries(TIPOS_DE_AVISO.map((t) => [t, guardadas[t] !== false])) as Preferencias
}

// Hasta saber si este dispositivo recibe avisos, vale null
function useRecibeAvisos(): boolean | null {
  const [recibe, setRecibe] = useState<boolean | null>(null)
  useEffect(() => {
    void avisosActivos().then(setRecibe)
  }, [])
  return recibe
}

// Mientras este dispositivo no reciba avisos, los interruptores se ven apagados y atenuados, y no se tocan:
// se eligen cuando ya están activados
export function InterruptoresDeAvisos({ preferencias, onCambio }: { preferencias: Preferencias; onCambio: (p: Preferencias) => void }) {
  const { avisos: textos, primeraVez } = useTextos()
  const recibe = useRecibeAvisos()
  const apagados = recibe !== true
  const sinInstalar = esIPhone && !estaInstalada()
  return (
    <>
      {recibe === false && <div className={estilos.estadoAvisos}>{sinInstalar ? primeraVez.primeroInstalar : textos.apagadosAqui}</div>}
      <div className={`${estilos.interruptores} ${apagados ? estilos.interruptoresApagados : ''}`} inert={apagados}>
        {TIPOS_DE_AVISO.map((tipo, i) => (
          <Interruptor key={tipo} etiqueta={textos.tipos[tipo]} activo={!apagados && preferencias[tipo]} onCambio={(activo) => onCambio({ ...preferencias, [tipo]: activo })} ultimo={i === TIPOS_DE_AVISO.length - 1} />
        ))}
      </div>
    </>
  )
}

// Estado de este dispositivo: instalada y con avisos
export function useDispositivo() {
  const [instalada, setInstalada] = useState(estaInstalada)
  const [avisos, setAvisos] = useState(false)
  useEffect(() => {
    void avisosActivos().then(setAvisos)
  }, [])
  return { instalada, setInstalada, avisos, setAvisos }
}

// ---------- Instalar ----------
export type ModoInstalar = 'iphone' | 'boton' | 'otro'

export function modoInstalar(): ModoInstalar {
  if (esIPhone) return 'iphone'
  return sePuedePedirInstalar() ? 'boton' : 'otro'
}

export function ComoInstalar({ modo }: { modo: ModoInstalar }) {
  const { instalar: textos } = useTextos()
  if (modo === 'iphone') {
    const iconos = [<Icono key="compartir" nombre="compartir" medida={26} />, <Icono key="inicio" nombre="agregarInicio" medida={26} />, <Tuerca key="tuerca" ancho={26} />]
    // Fuera de Safari (el navegador de WhatsApp, Chrome…) no se puede instalar: primero hay que abrir el enlace en Safari
    const pasos: { texto: string; icono: ReactNode }[] = textos.pasos.map((texto, i) => ({ texto, icono: iconos[i] }))
    if (!esSafari) pasos.unshift({ texto: textos.abrirEnSafari, icono: null })
    return (
      <>
        <Bajada>{textos.enIPhone}</Bajada>
        <ol className={estilos.pasos}>
          {pasos.map((paso, i) => (
            <li key={paso.texto} className={estilos.paso}>
              <span className={estilos.numero}>{i + 1}</span>
              <span className={estilos.pasoTexto}>{paso.texto}</span>
              <span className={estilos.pasoIcono}>{paso.icono}</span>
            </li>
          ))}
        </ol>
      </>
    )
  }
  return (
    <>
      <Bajada>{modo === 'boton' ? textos.queda : textos.otroNavegador}</Bajada>
      <div className={estilos.icono}>
        <span className={estilos.iconoApp}>
          <Tuerca ancho={52} />
        </span>
        <span className={estilos.iconoNombre}>Puente</span>
      </div>
    </>
  )
}

import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Atras } from '../../componentes/Controles.tsx'
import { Buscador } from '../../componentes/Buscador.tsx'
import { LineaDelGrupo } from '../../componentes/LineaDelGrupo.tsx'
import { DetallePersona, Tarjeta } from '../../componentes/Tarjeta.tsx'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { diaDelMes, diaDeLaSemana, diaLargo, hoyEnCalifornia, rangoLargo, sumarDias, ventanaDelViaje } from '../../datos/fechas.ts'
import { coincide, estaAlla, integrantes, porLlegada, tieneFechas } from '../../datos/grupo.ts'
import { nombreCompleto, primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { Numero } from '../../movimiento/index.ts'
import { useTextos, type Textos } from '../../textos.ts'
import { BarrasDelGrupo } from './BarrasDelGrupo.tsx'
import { CabeceraCelular, SegmentoGrupo } from './CabeceraGrupo.tsx'
import { estadoDe } from './estado.ts'
import { Intereses } from './Intereses.tsx'
import estilos from './Grupo.module.css'

// Marca donde va el número de la frase, para que salte al cambiar
const MARCA = '\u0000'

// Arriba de Grupo: cuántos hay allá hoy y quién llega o vuelve esta semana
function resumen(gente: Persona[], yo: string, hoy: string, textos: Textos): [string, string | null] {
  const t = textos.grupo
  const conFechas = gente.filter(tieneFechas)
  if (conFechas.length === 0) return [t.nadieTodavia, null]
  const nombre = (p: Persona) => (p.id === yo ? t.tuMinuscula : primerNombre(p))
  // "Diego y tú": tú siempre al final
  const nombres = (lista: Persona[]) => textos.y([...lista.filter((p) => p.id !== yo), ...lista.filter((p) => p.id === yo)].map(nombre))
  const primera = conFechas.map((p) => p.llega).sort()[0]
  const ultima = conFechas.map((p) => p.vuelve).sort()[conFechas.length - 1]

  if (hoy < primera) {
    const primeros = conFechas.filter((p) => p.llega === primera)
    if (primeros.length === 1 && primeros[0].id === yo) return [t.nadieTodavia, t.llegasPrimero(diaLargo(primera))]
    return [t.nadieTodavia, t.llegaPrimero(nombres(primeros), primeros.length > 1, diaLargo(primera))]
  }
  if (hoy > ultima) return [t.volvieronTodos, null]

  const linea1 = t.hayAlla(conFechas.filter((p) => estaAlla(p, hoy)).length, gente.length)
  const enUnaSemana = sumarDias(hoy, 7)
  const llegan = conFechas.filter((p) => p.llega > hoy && p.llega <= enUnaSemana).sort(porLlegada)
  if (llegan.length === 1 && llegan[0].id === yo) return [linea1, t.llegas(diaDeLaSemana(llegan[0].llega))]
  if (llegan.length > 0) return [linea1, t.llegan(textos.y(llegan.map((p) => t.el(nombre(p), diaDeLaSemana(p.llega)))), llegan.length > 1)]
  const vuelven = conFechas.filter((p) => p.vuelve >= hoy && p.vuelve < enUnaSemana)
  if (vuelven.length === 1 && vuelven[0].id === yo) return [linea1, t.vuelves]
  if (vuelven.length > 0) return [linea1, t.vuelven(nombres(vuelven), vuelven.length > 1)]
  return [linea1, null]
}

// Grupo: las estadías y, en /grupo/intereses, los temas de interés
export function Grupo() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/grupo/intereses')) return <Intereses />
  return <Estadias />
}

function Estadias() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const esComputador = useEsComputador()
  const { data: personas } = usePersonas()
  const [busqueda, setBusqueda] = useState('')
  // En el celular, el día que se mira al arrastrar sobre las barras (null: hoy)
  const [diaVisto, setDiaVisto] = useState<string | null>(null)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.grupo

  // Tu fila sale de la sesión, que tiene lo último que guardaste
  const gente = integrantes([yo, ...(personas ?? []).filter((p) => p.id !== yo.id)], yo.id)
  const hoy = hoyEnCalifornia()
  const ventana = ventanaDelViaje(gente)
  const [linea1, linea2] = resumen(gente, yo.id, hoy, textos)

  if (esComputador) {
    const visibles = gente.filter((p) => coincide(p, busqueda))
    const nadie = visibles.length === 0 ? textos.nadieCoincide(busqueda.trim()) : null
    const elegibles = gente.filter((p) => p.id !== yo.id && p.entro_en)
    const elegida = elegibles.find((p) => p.id === id) ?? elegibles[0] ?? null
    return (
      <div className={escritorio.pantalla}>
        <div className={escritorio.cabecera}>
          <div>
            <div className={estilos.tituloFilaPc}>
              <h1 className={escritorio.titulo}>{t.titulo}</h1>
              <SegmentoGrupo vista="estadias" />
            </div>
            <div className={escritorio.linea1}>{linea1}</div>
            {linea2 && <div className={escritorio.linea2}>{linea2}</div>}
          </div>
          <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscadorPc} />
        </div>
        <div className={escritorio.cuerpo}>
          <div className={escritorio.columnas}>
            <div className={escritorio.columna}>
              <LineaDelGrupo
                gente={gente}
                ventana={ventana}
                visibles={visibles}
                yo={yo.id}
                hoy={hoy}
                elegida={elegida?.id}
                onElegir={(otro) => navigate(`/grupo/${otro}`, { replace: true })}
              />
              {nadie && <div className={estilos.nadiePc}>{nadie}</div>}
            </div>
            <aside aria-label={elegida?.nombre ?? t.titulo} className={escritorio.lado}>
              {elegida ? (
                <>
                  <Tarjeta persona={elegida} />
                  <DetallePersona persona={elegida} yo={yo} />
                </>
              ) : (
                <div className={escritorio.vacio}>{t.elige}</div>
              )}
            </aside>
          </div>
        </div>
      </div>
    )
  }

  // Celular: el perfil de una persona es otra pantalla, con "Grupo" para volver (o el tema, si se abrió desde uno)
  if (id) {
    const volver = location.state as { volverA?: string; volverTexto?: string } | null
    const persona = gente.find((p) => p.id === id && p.entro_en)
    if (!persona) return personas ? <Navigate to="/grupo" replace /> : null
    if (persona.id === yo.id) return <Navigate to="/perfil" replace />
    return (
      <div className={estilos.ficha}>
        <div className={estilos.volver}>
          <Atras texto={volver?.volverTexto ?? t.titulo} onClick={() => navigate(volver?.volverA ?? '/grupo')} />
        </div>
        <Tarjeta persona={persona} />
        <DetallePersona persona={persona} yo={yo} />
      </div>
    )
  }

  // Celular: las barras con nombre, sin buscador (los 14 caben a la vista). Tocar a alguien abre su perfil; el tuyo es
  // Tu perfil, y quien todavía no entra no tiene perfil que abrir
  const abrir = (p: Persona) => (p.id === yo.id ? () => navigate('/perfil') : p.entro_en ? () => navigate(`/grupo/${p.id}`) : undefined)
  const describir = (p: Persona) =>
    t.fila(p.id === yo.id ? t.tu : nombreCompleto(p), estadoDe(p, yo.id, hoy, textos), tieneFechas(p) ? rangoLargo(p.llega, p.vuelve) : null)

  // "Hoy hay 12 de 14 allá." cambia a "El 20 de enero hay 9 de 14 allá." mientras se arrastra (el día de la semana ya va
  // sobre la raya); el número salta al cambiar
  const hayEl = (dia: string) => gente.filter((p) => estaAlla(p, dia)).length
  const conNumero = (texto: string, n: number) => {
    const [antes, despues] = texto.split(MARCA)
    return (
      <>
        {antes}
        <Numero valor={n} conSonido={false} />
        {despues}
      </>
    )
  }
  const fraseDelCelular =
    diaVisto !== null
      ? conNumero(t.hayAllaEl(diaDelMes(diaVisto), MARCA, gente.length), hayEl(diaVisto))
      : linea1 === t.hayAlla(hayEl(hoy), gente.length)
        ? conNumero(t.hayAlla(MARCA, gente.length), hayEl(hoy))
        : linea1

  return (
    <div className={estilos.celular}>
      <CabeceraCelular vista="estadias">
        <div className={estilos.linea1}>{fraseDelCelular}</div>
        {linea2 && <div className={estilos.linea2}>{linea2}</div>}
      </CabeceraCelular>
      <BarrasDelGrupo gente={gente} ventana={ventana} yo={yo.id} hoy={hoy} abrir={abrir} describir={describir} onVer={setDiaVisto} />
    </div>
  )
}

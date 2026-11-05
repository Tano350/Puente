import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Atras } from '../../componentes/Controles.tsx'
import { Avatar } from '../../componentes/Avatar.tsx'
import { EntradaPerfil } from '../../componentes/EntradaPerfil.tsx'
import { Buscador } from '../../componentes/Buscador.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { LineaDelGrupo } from '../../componentes/LineaDelGrupo.tsx'
import { DetallePersona, Tarjeta } from '../../componentes/Tarjeta.tsx'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { diaCorto, diaDeLaSemana, diaLargo, hoyEnCalifornia, rangoCorto, sumarDias, ventanaDelViaje } from '../../datos/fechas.ts'
import { coincide, estaAlla, integrantes, porLlegada, tieneFechas } from '../../datos/grupo.ts'
import { carreraCorta, nombreCompleto, primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'
import estilos from './Grupo.module.css'

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

// "● Allá", "Llega el 15 ene", "Último día", "Volvió"…
function estadoEnLista(p: Persona, yo: string, hoy: string, textos: Textos): { texto: string; alla: boolean } {
  const t = textos.grupo
  if (!p.entro_en) return { texto: t.sinEntrar, alla: false }
  if (!tieneFechas(p)) return { texto: t.sinFechas, alla: false }
  const tuyo = p.id === yo
  if (hoy < p.llega) return { texto: tuyo ? t.llegasCorto(diaCorto(p.llega)) : t.llega(diaCorto(p.llega)), alla: false }
  if (hoy > p.vuelve) return { texto: tuyo ? t.volviste : t.volvio, alla: false }
  return { texto: hoy === p.vuelve ? t.ultimoDia : t.alla, alla: true }
}

function FilaIntegrante({ persona, yo, hoy, onAbrir }: { persona: Persona; yo: string; hoy: string; onAbrir?: () => void }) {
  const textos = useTextos()
  const tuyo = persona.id === yo
  const estado = estadoEnLista(persona, yo, hoy, textos)
  const detalle = [carreraCorta(persona.carrera), tieneFechas(persona) ? rangoCorto(persona.llega, persona.vuelve) : ''].filter(Boolean).join(', ')
  const contenido = (
    <>
      {tuyo ? (
        <span className={estilos.tuAvatar} aria-hidden="true">{textos.grupo.tu}</span>
      ) : persona.entro_en ? (
        <Avatar persona={persona} medida={40} />
      ) : (
        <span className={estilos.sobre} aria-hidden="true">
          <Icono nombre="correo" medida={18} />
        </span>
      )}
      <span className={estilos.quien}>
        <span className={estilos.nombre} data-tu={tuyo}>{tuyo ? textos.grupo.tu : nombreCompleto(persona)}</span>
        {detalle && <span className={estilos.detalle}>{detalle}</span>}
      </span>
      <span className={estilos.estado} data-alla={estado.alla}>
        {estado.alla && <span className={estilos.punto} aria-hidden="true" />}
        {estado.texto}
      </span>
    </>
  )
  // Quien todavía no entra no tiene perfil que abrir
  if (!onAbrir) return <div className={estilos.integrante}>{contenido}</div>
  return (
    <button type="button" className={estilos.integrante} onClick={onAbrir}>
      {contenido}
    </button>
  )
}

export function Grupo() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const { id } = useParams()
  const esComputador = useEsComputador()
  const { data: personas } = usePersonas()
  const [busqueda, setBusqueda] = useState('')
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.grupo

  // Tu fila sale de la sesión, que tiene lo último que guardaste
  const gente = integrantes([yo, ...(personas ?? []).filter((p) => p.id !== yo.id)], yo.id)
  const hoy = hoyEnCalifornia()
  const ventana = ventanaDelViaje(gente)
  const [linea1, linea2] = resumen(gente, yo.id, hoy, textos)
  const visibles = gente.filter((p) => coincide(p, busqueda))
  const nadie = visibles.length === 0 ? textos.nadieCoincide(busqueda.trim()) : null

  if (esComputador) {
    const elegibles = gente.filter((p) => p.id !== yo.id && p.entro_en)
    const elegida = elegibles.find((p) => p.id === id) ?? elegibles[0] ?? null
    return (
      <div className={escritorio.pantalla}>
        <div className={escritorio.cabecera}>
          <div>
            <h1 className={escritorio.titulo}>{t.titulo}</h1>
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
                computador
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

  // Celular: el perfil de una persona es otra pantalla, con "Grupo" para volver
  if (id) {
    const persona = gente.find((p) => p.id === id && p.entro_en)
    if (!persona) return personas ? <Navigate to="/grupo" replace /> : null
    if (persona.id === yo.id) return <Navigate to="/perfil" replace />
    return (
      <div className={estilos.ficha}>
        <div className={estilos.volver}>
          <Atras texto={t.titulo} onClick={() => navigate('/grupo')} />
        </div>
        <Tarjeta persona={persona} />
        <DetallePersona persona={persona} yo={yo} />
      </div>
    )
  }

  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <div className={estilos.cabeceraFila}>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          <EntradaPerfil />
        </div>
        <div className={estilos.linea1}>{linea1}</div>
        {linea2 && <div className={estilos.linea2}>{linea2}</div>}
      </div>
      <LineaDelGrupo gente={gente} ventana={ventana} yo={yo.id} hoy={hoy} />
      <div className={estilos.integrantes}>
        <span>{t.integrantes}</span>
        <span className={estilos.cuenta}>{gente.length}</span>
      </div>
      <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscador} />
      <div className={estilos.lista}>
        {visibles.map((p) => (
          <FilaIntegrante
            key={p.id}
            persona={p}
            yo={yo.id}
            hoy={hoy}
            onAbrir={p.id === yo.id ? () => navigate('/perfil') : p.entro_en ? () => navigate(`/grupo/${p.id}`) : undefined}
          />
        ))}
      </div>
      {nadie && <div className={estilos.nadie}>{nadie}</div>}
    </div>
  )
}

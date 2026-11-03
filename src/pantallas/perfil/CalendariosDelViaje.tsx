import { useState } from 'react'
import { BotonBorde, BotonPrincipal, Fila, Grupo, Hoja, Interruptor, TituloHoja } from '../../componentes/Controles.tsx'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { asignarCalendario, buscarCalendarios, cambiarSincronizacion, useCalendariosDelViaje, useSincronizacion, type Calendario } from '../../datos/calendario.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './CalendariosDelViaje.module.css'

// Solo quien administra, con Google ya conectado: de quién es cada calendario del viaje y el interruptor de la
// sincronización. Apagada (como parte), Puente no lee ni escribe en ningún calendario; encenderla se confirma.
export function CalendariosDelViaje() {
  const textos = useTextos()
  const sesion = useSesion()
  const t = textos.calendario
  const { data: calendarios = [] } = useCalendariosDelViaje(true)
  const { data: estado } = useSincronizacion(true)
  const { data: personas = [] } = usePersonas()
  const [eligiendo, setEligiendo] = useState<Calendario | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const activa = estado?.activa ?? false

  const intentar = async (accion: () => Promise<void>, siFalla = textos.noSeGuardo) => {
    setProblema(null)
    try {
      await accion()
    } catch {
      setProblema(siFalla)
    }
  }
  const encender = (si: boolean) => {
    setConfirmar(false)
    void intentar(() => cambiarSincronizacion(si))
  }
  const buscar = async () => {
    setBuscando(true)
    await intentar(buscarCalendarios, t.noSeBusco)
    setBuscando(false)
  }
  const asignar = (calendario: Calendario, persona: string) => {
    setEligiendo(null)
    void intentar(() => asignarCalendario(calendario.google_id, persona))
  }

  const nombreDe = (id: string | null) => {
    if (sesion.tipo === 'dentro' && id === sesion.persona.id) return textos.grupo.tu
    const persona = id ? personas.find((p) => p.id === id) : undefined
    return persona ? (persona.nombre ?? persona.correo) : t.sinAsignar
  }
  // Cada revisión marca los calendarios que ve; uno asignado que quedó atrás ya no está en la cuenta conectada
  const ultimaRevision = Math.max(...calendarios.map((c) => Date.parse(c.visto_en)))
  const noAparece = (c: Calendario) => Date.parse(c.visto_en) < ultimaRevision - 60_000
  const soloVer = calendarios.filter((c) => c.permiso === 'reader' || c.permiso === 'freeBusyReader').map((c) => c.nombre)
  const minutos = estado?.ultima_vez ? Math.max(0, Math.round((Date.now() - Date.parse(estado.ultima_vez)) / 60_000)) : null

  return (
    <>
      <div className={estilos.bajada}>{t.elige}</div>
      <div className={estilos.interruptor}>
        <Interruptor etiqueta={t.sincronizar} activo={activa} onCambio={(si) => (si ? setConfirmar(true) : encender(false))} ultimo />
      </div>
      <div className={estilos.estado}>{activa ? t.encendida(minutos === null ? null : t.hace(minutos)) : t.apagada}</div>
      {activa && estado && estado.errores > 0 && (
        <div className={estilos.estado} data-error="true">
          {t.errores(estado.errores)}
        </div>
      )}
      {/* El reloj revisa cada 10 minutos: si lleva mucho sin hacerlo, lo más probable es que Google haya quitado el permiso */}
      {activa && minutos !== null && minutos > 30 && (
        <div className={estilos.estado} data-error="true">
          {t.sinRevisar}
        </div>
      )}

      <div className={estilos.cabeza}>
        <span className={estilos.rotulo}>{t.calendarios}</span>
        <button type="button" className={estilos.buscar} disabled={buscando} onClick={() => void buscar()}>
          {buscando ? t.buscando : t.buscar}
        </button>
      </div>
      {calendarios.length > 0 ? (
        <Grupo arriba={4}>
          {calendarios.map((c) => (
            <Fila key={c.google_id} etiqueta={c.nombre} valor={noAparece(c) ? t.noAparece : nombreDe(c.persona)} onClick={() => setEligiendo(c)} />
          ))}
        </Grupo>
      ) : (
        <div className={estilos.vacio}>{t.sinCalendarios}</div>
      )}
      {soloVer.length > 0 && <div className={estilos.nota}>{t.soloVer(soloVer)}</div>}
      {problema && (
        <div className={estilos.estado} data-error="true" role="alert">
          {problema}
        </div>
      )}

      <ElegirPersona
        abierta={eligiendo !== null}
        titulo={t.deQuien(eligiendo?.nombre ?? '')}
        elegida={eligiendo?.persona}
        onElegir={(persona) => eligiendo && asignar(eligiendo, persona.id)}
        onCerrar={() => setEligiendo(null)}
      />
      <Hoja abierta={confirmar} etiqueta={t.encender} onCerrar={() => setConfirmar(false)}>
        <TituloHoja>{t.encender}</TituloHoja>
        <div className={estilos.hojaTexto}>{t.encenderExplica}</div>
        <div className={estilos.hojaBotones}>
          <BotonPrincipal onClick={() => encender(true)}>{t.siEncender}</BotonPrincipal>
          <BotonBorde onClick={() => setConfirmar(false)}>{textos.cancelar}</BotonBorde>
        </div>
      </Hoja>
    </>
  )
}

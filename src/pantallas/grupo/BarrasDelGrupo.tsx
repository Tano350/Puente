import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Persona } from '../../datos/consultas.ts'
import { diaConSemana, indiceEnElViaje, mesesDe, sumarDias, type Ventana } from '../../datos/fechas.ts'
import { estaAlla, porLlegada, porNombre, tieneFechas } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { cuerpo, diaBajo, seguir, sonar, vibrar } from '../../movimiento/index.ts'
import { useTextos } from '../../textos.ts'
import estilos from './BarrasDelGrupo.module.css'

type Lado = 'derecha' | 'izquierda'

type Props = {
  // En el orden de integrantes(): tú primero
  gente: Persona[]
  // Los días que cubren las barras: enero y febrero, estirados si alguien llega antes o se va después
  ventana: Ventana
  yo: string
  hoy: string
  // Qué pasa al tocar a alguien. Sin función, su fila no se toca: quien todavía no entra no tiene perfil
  abrir: (persona: Persona) => (() => void) | undefined
  // La frase entera de cada fila, para el lector de pantalla: nombre, estado y fechas
  describir: (persona: Persona) => string
  // Al arrastrar de lado sobre las barras, el día que queda bajo el dedo (null al soltar)
  onVer: (dia: string | null) => void
}

// "mié 20": el día corto que va sobre la raya mientras se arrastra
const diaCortito = (iso: string) => `${diaConSemana(iso).split(/[ ,]/)[0].toLowerCase()} ${Number(iso.slice(8))}`

function iguales(a: Record<string, Lado>, b: Record<string, Lado>): boolean {
  const llaves = Object.keys(a)
  return llaves.length === Object.keys(b).length && llaves.every((llave) => a[llave] === b[llave])
}

// Grupo en el celular: la estadía de cada uno es una barra con su nombre adentro, tú primero y después por orden de
// llegada, como un horario. La raya de hoy pasa por detrás de las barras. Quien no tiene fechas, o todavía no entra,
// va al final y sin barra. Toda la fila se toca y abre el perfil.
export function BarrasDelGrupo({ gente, ventana: viaje, yo, hoy, abrir, describir, onVer }: Props) {
  const t = useTextos().grupo
  const lista = useRef<HTMLUListElement>(null)
  const zona = useRef<HTMLDivElement>(null)
  const raya = useRef<HTMLSpanElement>(null)
  const etiqueta = useRef<HTMLSpanElement>(null)
  // El día que se está mirando al arrastrar (índice en el viaje); null si no se arrastra
  const [mirando, setMirando] = useState<number | null>(null)
  // Si el nombre no cabe en su barra (una estadía corta), va al lado: a la derecha o, si ahí no hay espacio, a la izquierda
  const [fuera, setFuera] = useState<Record<string, Lado>>({})

  const medir = useCallback(() => {
    const filas = lista.current
    if (!filas) return
    const nuevo: Record<string, Lado> = {}
    for (const barra of filas.querySelectorAll<HTMLElement>('[data-barra]')) {
      const nombre = barra.firstElementChild
      if (!(nombre instanceof HTMLElement) || nombre.offsetWidth <= barra.clientWidth) continue
      nuevo[barra.dataset.barra ?? ''] = barra.offsetLeft + barra.offsetWidth + nombre.offsetWidth <= filas.clientWidth ? 'derecha' : 'izquierda'
    }
    setFuera((antes) => (iguales(antes, nuevo) ? antes : nuevo))
  }, [])

  // Se mide antes de pintar, después de cada cambio, y otra vez si cambia el ancho o terminan de cargar las letras
  useLayoutEffect(medir)
  useEffect(() => {
    const filas = lista.current
    if (!filas) return
    const observador = new ResizeObserver(medir)
    observador.observe(filas)
    void document.fonts.ready.then(medir)
    return () => observador.disconnect()
  }, [medir])

  const enElViaje = (i: number) => Math.min(Math.max(i, 0), viaje.dias - 1)
  const porcentaje = (dias: number) => `${(dias / viaje.dias) * 100}%`
  const conFechas = gente.filter(tieneFechas).sort((a, b) => (a.id === yo ? -1 : b.id === yo ? 1 : porLlegada(a, b) || porNombre(a, b)))
  const sinFechas = gente.filter((p) => !tieneFechas(p))
  const meses = mesesDe(viaje)
  // Dónde empieza cada mes, salvo el primero: una línea tenue por detrás de las barras
  const cortes = meses.slice(1).map((_, i) => meses.slice(0, i + 1).reduce((dias, mes) => dias + mes.dias, 0))
  const hoyEnLaLinea = indiceEnElViaje(hoy, viaje)
  const verHoy = hoyEnLaLinea >= 0 && hoyEnLaLinea < viaje.dias
  // Arrastrar de lado mueve la raya de hoy al día que queda bajo el dedo (de a un día, con resorte); al soltar, vuelve
  const mover = (dia: number | null, ancho: number) => {
    const x = dia === null ? 0 : ((dia - hoyEnLaLinea) * ancho) / viaje.dias
    for (const el of [raya.current, etiqueta.current]) if (el) cuerpo(el).meta({ x })
  }
  const arrastrar = (e: ReactPointerEvent) => {
    const caja = zona.current
    if (!verHoy || !caja) return
    let ultimo = -1
    const ver = (x: number) => {
      const r = caja.getBoundingClientRect()
      const dia = diaBajo(x, r.left, r.width, viaje.dias)
      if (dia === ultimo) return
      if (ultimo !== -1) {
        sonar('giro', 0.3)
        vibrar(3)
      }
      ultimo = dia
      setMirando(dia)
      mover(dia, r.width)
      onVer(sumarDias(viaje.desde, dia))
    }
    seguir(e, {
      eje: 'x',
      alMover: (p) => ver(p.x),
      alSoltar: () => {
        setMirando(null)
        mover(null, 0)
        onVer(null)
      },
    })
  }
  const nombre = (p: Persona) => (p.id === yo ? t.tu : primerNombre(p))

  // El lector de pantalla lee la frase entera; la barra y el nombre son solo para la vista
  const fila = (p: Persona, clase: string, vista: ReactNode) => {
    const accion = abrir(p)
    const contenido = (
      <>
        <span className={estilos.oculto}>{describir(p)}</span>
        {vista}
      </>
    )
    return (
      <li key={p.id}>
        {accion ? (
          <button type="button" className={clase} onClick={accion}>
            {contenido}
          </button>
        ) : (
          <div className={clase}>{contenido}</div>
        )}
      </li>
    )
  }

  return (
    <div className={estilos.linea}>
      <div className={estilos.meses} aria-hidden="true">
        {meses.map((mes) => (
          <span key={mes.nombre} style={{ flex: mes.dias }}>
            {mes.dias < 7 ? '' : mes.dias < 20 ? mes.nombre.slice(0, 3) : mes.nombre}
          </span>
        ))}
      </div>
      {verHoy && (
        <div className={estilos.hoyArriba} aria-hidden="true">
          <span ref={etiqueta} style={{ left: porcentaje(hoyEnLaLinea + 0.5) }}>
            {mirando === null || mirando === hoyEnLaLinea ? t.hoyRaya : diaCortito(sumarDias(viaje.desde, mirando))}
          </span>
        </div>
      )}
      <div ref={zona} className={estilos.cuerpo} data-arrastrable onPointerDown={arrastrar}>
        {cortes.map((dia) => (
          <span key={dia} className={estilos.corte} style={{ left: porcentaje(dia) }} />
        ))}
        {verHoy && <span ref={raya} className={estilos.hoy} style={{ left: porcentaje(hoyEnLaLinea + 0.5) }} />}
        <ul ref={lista} className={estilos.filas} aria-label={t.estadias}>
          {conFechas.map((p) => {
            const llega = enElViaje(indiceEnElViaje(p.llega, viaje))
            const vuelve = enElViaje(indiceEnElViaje(p.vuelve, viaje))
            return fila(
              p,
              estilos.fila,
              <span
                className={estilos.barra}
                aria-hidden="true"
                data-barra={p.id}
                data-tu={p.id === yo}
                data-ausente={mirando !== null && !estaAlla(p, sumarDias(viaje.desde, mirando))}
                data-fuera={fuera[p.id]}
                style={{ left: porcentaje(llega), width: porcentaje(vuelve - llega + 1) }}
              >
                <span className={estilos.nombre}>{nombre(p)}</span>
              </span>,
            )
          })}
        </ul>
      </div>
      {sinFechas.length > 0 && (
        <ul className={estilos.sinFechas}>
          {sinFechas.map((p) =>
            fila(
              p,
              estilos.filaSinFechas,
              <span className={estilos.suelta} aria-hidden="true">
                <span className={estilos.nombreSuelto} data-tu={p.id === yo}>
                  {nombre(p)}
                </span>
                <span className={estilos.motivo}>{p.entro_en ? t.sinFechas : t.sinEntrar}</span>
              </span>,
            ),
          )}
        </ul>
      )}
    </div>
  )
}

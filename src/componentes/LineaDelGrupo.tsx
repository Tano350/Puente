import type { Persona } from '../datos/consultas.ts'
import { indiceEnElViaje, mesesDe, type Ventana } from '../datos/fechas.ts'
import { tieneFechas } from '../datos/grupo.ts'
import { primerNombre } from '../datos/nombres.ts'
import { useTextos } from '../textos.ts'
import { Avatar } from './Avatar.tsx'
import estilos from './LineaDelGrupo.module.css'

type Props = {
  gente: Persona[]
  // Los días que cubre el gráfico: enero y febrero, estirados si alguien llega antes o se va después
  ventana: Ventana
  yo: string
  hoy: string
  // En el computador cada fila se elige y el perfil se ve al lado
  computador?: boolean
  visibles?: Persona[]
  elegida?: string | null
  onElegir?: (id: string) => void
}

// Enero y febrero del grupo: arriba cuántos están allá cada día, abajo la estadía de cada uno y una raya en hoy
export function LineaDelGrupo({ gente, ventana: viaje, yo, hoy, computador = false, visibles = gente, elegida = null, onElegir }: Props) {
  const textos = useTextos()
  const t = textos.grupo
  const enElViaje = (i: number) => Math.min(Math.max(i, 0), viaje.dias - 1)
  const porcentaje = (dias: number) => `${(dias / viaje.dias) * 100}%`
  const tramos = new Map(gente.filter(tieneFechas).map((p) => [p.id, [enElViaje(indiceEnElViaje(p.llega, viaje)), enElViaje(indiceEnElViaje(p.vuelve, viaje))]]))
  const cuantos = Array.from({ length: viaje.dias }, (_, i) => [...tramos.values()].filter(([a, b]) => a <= i && i <= b).length)
  const escala = Math.max(gente.length, 1)
  const hoyEnLaLinea = indiceEnElViaje(hoy, viaje)
  const verHoy = hoyEnLaLinea >= 0 && hoyEnLaLinea < viaje.dias
  // Quien todavía no entra sale con el nombre con que lo invitaron o, si no, el de su correo; "Sin entrar" va en su fila
  const nombre = (p: Persona) => (p.id === yo ? t.tu : primerNombre(p))

  const pista = (p: Persona) => {
    const tramo = tramos.get(p.id)
    if (!tramo) return <span className={estilos.sinTramo}>{p.entro_en ? t.sinFechas : t.sinEntrar}</span>
    const [a, b] = tramo
    return (
      <span className={estilos.pista}>
        <span className={estilos.tramo} data-tu={p.id === yo} style={{ left: porcentaje(a), width: porcentaje(b - a + 1) }} />
      </span>
    )
  }

  const fila = (p: Persona) => {
    if (!computador) {
      return (
        <div key={p.id} className={estilos.fila}>
          <span className={estilos.nombre} data-tu={p.id === yo}>{nombre(p)}</span>
          {pista(p)}
        </div>
      )
    }
    const etiqueta = (
      <span className={estilos.etiqueta}>
        {p.id === yo ? <span className={estilos.tuAvatar} aria-hidden="true">{t.tu}</span> : <Avatar persona={p} medida={26} />}
        <span className={estilos.nombrePc} data-tu={p.id === yo} data-fuera={!p.entro_en}>{nombre(p)}</span>
      </span>
    )
    // Tú y quien todavía no entra no tienen perfil que mostrar al lado
    if (p.id === yo || !p.entro_en || !onElegir) {
      return (
        <div key={p.id} className={estilos.filaPc}>
          {etiqueta}
          {pista(p)}
        </div>
      )
    }
    return (
      <button key={p.id} type="button" className={estilos.filaPc} aria-pressed={elegida === p.id} onClick={() => onElegir(p.id)}>
        {etiqueta}
        {pista(p)}
      </button>
    )
  }

  return (
    <div className={estilos.linea} data-computador={computador}>
      <div className={estilos.meses}>
        {mesesDe(viaje).map((mes) => (
          <span key={mes.nombre} style={{ flex: mes.dias }}>{mes.dias < 7 ? '' : mes.dias < 20 ? mes.nombre.slice(0, 3) : mes.nombre}</span>
        ))}
      </div>
      <div className={estilos.cuerpo} data-hoy={verHoy}>
        {verHoy && (
          <div className={estilos.hoy} aria-hidden="true" style={{ left: `calc(var(--etiqueta) + (100% - var(--etiqueta)) * ${(hoyEnLaLinea + 0.5) / viaje.dias})` }}>
            <span className={estilos.hoyEtiqueta}>{t.hoyRaya}</span>
          </div>
        )}
        <div role="img" aria-label={t.grafico} className={estilos.barras}>
          {cuantos.map((n, i) => (
            <span key={i} className={estilos.barra} data-hoy={i === hoyEnLaLinea} style={{ height: Math.max(computador ? 2 : 1, Math.round((n / escala) * 40)) }} />
          ))}
        </div>
        <div className={estilos.filas}>{visibles.map(fila)}</div>
      </div>
    </div>
  )
}

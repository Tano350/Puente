import { Icono } from '../../componentes/Icono.tsx'
import { miLugar, type Asistente, type Evento } from '../../datos/eventos.ts'
import { CHILE, hora } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { cuposLibres } from './HoyDatos.ts'
import estilos from './HoyGrupo.module.css'

// También hoy en el grupo: lo que viene hoy y al que te puedes sumar con "Voy" (o en cuya lista de espera estás).
// En el celular la fila deja libre la columna del riel, para calzar con la línea de arriba.
export function TambienHoy({
  eventos,
  asistentes,
  yo,
  chile,
  computador,
  elegido,
  yendo,
  onAbrir,
  onVoy,
}: {
  eventos: Evento[]
  asistentes: Asistente[]
  yo: string
  chile: boolean
  computador: boolean
  elegido: string | null
  yendo: string | null
  onAbrir: (id: string) => void
  onVoy: (evento: Evento) => void
}) {
  const t = useTextos().hoy.viaje
  return (
    <ul className={estilos.lista} data-computador={computador}>
      {eventos.map((e) => {
        const libres = cuposLibres(e, asistentes)
        const lugar = miLugar(e.id, asistentes, yo)
        const puesto = lugar?.estado === 'espera' ? lugar.puesto : null
        const detalle = puesto !== null ? t.enEspera(puesto, e.lugar) : libres === null ? t.paraTodos(e.lugar) : t.quedan(libres, e.lugar)
        const ocupado = yendo === e.id
        return (
          <li key={e.id} className={estilos.fila} data-elegida={computador && elegido === e.id}>
            <span className={estilos.horas}>
              <span className={estilos.hora}>{hora(e.inicio)}</span>
              {chile && <span className={estilos.chile}>{hora(e.inicio, CHILE)}</span>}
            </span>
            <button type="button" className={estilos.datos} aria-pressed={computador ? elegido === e.id : undefined} onClick={() => onAbrir(e.id)}>
              <span className={estilos.titulo}>{e.titulo}</span>
              <span className={estilos.detalle}>{detalle}</span>
            </button>
            {puesto === null && (
              <button type="button" className={estilos.voy} aria-label={t.voyA(e.titulo)} aria-disabled={ocupado} onClick={() => !ocupado && onVoy(e)}>
                {ocupado ? (
                  <>
                    <Icono nombre="check" medida={18} trazo={2} />
                    {t.vas}
                  </>
                ) : (
                  t.voy
                )}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { Icono } from '../../componentes/Icono.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { miLugar, type Asistente, type Evento } from '../../datos/eventos.ts'
import { CHILE, hora } from '../../datos/fechas.ts'
import { temaPendiente, type Tema } from '../../datos/intereses.ts'
import { useTextos } from '../../textos.ts'
import { cuposLibres } from './HoyDatos.ts'
import estilos from './HoyGrupo.module.css'

// También hoy en el grupo: lo que viene hoy y al que te puedes sumar con "Voy" o "Tomar cupo" (o en cuya lista de espera estás).
// En el celular la fila deja libre la columna del riel, para calzar con la línea de arriba.
export function TambienHoy({
  eventos,
  asistentes,
  temas,
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
  temas: Tema[]
  yo: string
  chile: boolean
  computador: boolean
  elegido: string | null
  yendo: string | null
  onAbrir: (id: string) => void
  onVoy: (evento: Evento) => void
}) {
  const textos = useTextos()
  const t = textos.hoy.viaje
  // Sin conexión, "Voy" queda apagado; al tocarlo, un aviso dice por qué
  const sinRed = !useConectado()
  return (
    <ul className={estilos.lista} data-computador={computador}>
      {eventos.map((e) => {
        const libres = cuposLibres(e, asistentes)
        const lugar = miLugar(e.id, asistentes, yo)
        const puesto = lugar?.estado === 'espera' ? lugar.puesto : null
        const detalle = puesto !== null ? t.enEspera(puesto, e.lugar) : libres === null ? t.paraTodos(e.lugar) : t.quedan(libres, e.lugar)
        const ocupado = yendo === e.id
        // Lo que todavía es solo para los de un tema (y es tuyo: lo demás no llega aquí)
        const tema = temaPendiente(e, temas)
        // Las mismas palabras que la Agenda: "Voy" en lo que es para todos y "Tomar cupo" en lo que tiene cupos
        const conCupo = e.modo !== 'para_todos'
        return (
          <li key={e.id} className={estilos.fila} data-elegida={computador && elegido === e.id}>
            <span className={estilos.horas}>
              <span className={estilos.hora}>{hora(e.inicio)}</span>
              {chile && <span className={estilos.chile}>{hora(e.inicio, CHILE)}</span>}
            </span>
            <button type="button" className={estilos.datos} aria-pressed={computador ? elegido === e.id : undefined} onClick={() => onAbrir(e.id)}>
              <span className={estilos.titulo}>{e.titulo}</span>
              <span className={estilos.detalle}>{detalle}</span>
              {tema && (
                <span className={`${estilos.detalle} ${estilos.tema}`}>
                  <Icono nombre="grupo" medida={15} trazo={2} />
                  {textos.intereses.comun.primeroPara(tema.nombre)}
                </span>
              )}
            </button>
            {puesto === null && (
              <button type="button" className={estilos.voy} aria-label={conCupo ? t.tomarCupoEn(e.titulo) : t.voyA(e.titulo)} aria-disabled={ocupado || sinRed} data-sin-red={sinRed} onClick={() => !ocupado && onVoy(e)}>
                {ocupado ? (
                  <>
                    <Icono nombre="check" medida={18} trazo={2} />
                    {t.vas}
                  </>
                ) : conCupo ? (
                  t.tomarCupo
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

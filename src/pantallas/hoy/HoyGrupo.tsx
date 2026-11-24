import { useEffect, useRef, type ReactNode } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { miLugar, type Asistente, type Evento } from '../../datos/eventos.ts'
import { CHILE, hora } from '../../datos/fechas.ts'
import { empujon, Numero } from '../../movimiento/index.ts'
import { useTextos } from '../../textos.ts'
import { cuposLibres } from './HoyDatos.ts'
import estilos from './HoyGrupo.module.css'

// El texto con el número que sea el primero suelto (los cupos que quedan) corriendo hacia su valor nuevo
function conNumero(texto: string, n: number): ReactNode {
  const hallado = new RegExp(`(?<!\\d)${n}(?!\\d)`).exec(texto)
  if (!hallado) return texto
  return (
    <>
      {texto.slice(0, hallado.index)}
      <Numero valor={n} />
      {texto.slice(hallado.index + hallado[0].length)}
    </>
  )
}

// "Voy" / "Tomar cupo"; al tomarlo cambia a "✓ Vas" con un salto
function BotonVoy({ ocupado, sinRed, etiqueta, texto, onClick }: { ocupado: boolean; sinRed: boolean; etiqueta: string; texto: string; onClick: () => void }) {
  const t = useTextos().hoy.viaje
  const boton = useRef<HTMLButtonElement>(null)
  const antes = useRef(ocupado)
  useEffect(() => {
    if (ocupado && !antes.current) empujon(boton.current, { s: 1.4 })
    antes.current = ocupado
  }, [ocupado])
  return (
    <button ref={boton} type="button" className={estilos.voy} aria-label={etiqueta} aria-disabled={ocupado || sinRed} data-sin-red={sinRed} onClick={onClick}>
      {ocupado ? (
        <>
          <Icono nombre="check" medida={18} trazo={2} />
          {t.vas}
        </>
      ) : (
        texto
      )}
    </button>
  )
}

// También hoy en el grupo: lo que viene hoy y al que te puedes sumar con "Voy" o "Tomar cupo" (o en cuya lista de espera estás).
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
  // Sin conexión, "Voy" queda apagado; al tocarlo, un aviso dice por qué
  const sinRed = !useConectado()
  return (
    <ul className={estilos.lista} data-computador={computador}>
      {eventos.map((e) => {
        const libres = cuposLibres(e, asistentes)
        const lugar = miLugar(e.id, asistentes, yo)
        const puesto = lugar?.estado === 'espera' ? lugar.puesto : null
        const detalle = puesto !== null ? t.enEspera(puesto, e.lugar) : libres === null ? t.paraTodos(e.lugar) : conNumero(t.quedan(libres, e.lugar), libres)
        const ocupado = yendo === e.id
        // Las mismas palabras que la Agenda: "Voy" en lo que es para todos y "Tomar cupo" en lo que tiene cupos
        const conCupo = e.modo !== 'para_todos'
        return (
          <li key={e.id} className={estilos.fila} data-flip={`ev-${e.id}`} data-elegida={computador && elegido === e.id}>
            <span className={estilos.horas}>
              <span className={estilos.hora}>{hora(e.inicio)}</span>
              {chile && <span className={estilos.chile}>{hora(e.inicio, CHILE)}</span>}
            </span>
            <button type="button" className={estilos.datos} aria-pressed={computador ? elegido === e.id : undefined} onClick={() => onAbrir(e.id)}>
              <span className={estilos.titulo}>{e.titulo}</span>
              <span className={estilos.detalle}>{detalle}</span>
            </button>
            {puesto === null && (
              <BotonVoy ocupado={ocupado} sinRed={sinRed} etiqueta={conCupo ? t.tomarCupoEn(e.titulo) : t.voyA(e.titulo)} texto={conCupo ? t.tomarCupo : t.voy} onClick={() => !ocupado && onVoy(e)} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

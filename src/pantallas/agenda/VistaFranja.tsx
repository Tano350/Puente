import { useRef } from 'react'
import { conMayuscula, diaLargo, type Ventana } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { enElViaje } from './AgendaDatos.ts'
import estilos from './VistaFranja.module.css'

// La semana como franja de días: el elegido va lleno y hoy dice "hoy". En el celular se desliza a otra semana.
export function VistaFranja({ dias, elegido, hoy, computador, viaje, onElegir, onSemana }: { dias: string[]; elegido: string; hoy: string; computador: boolean; viaje: Ventana; onElegir: (dia: string) => void; onSemana?: (paso: number) => void }) {
  const tv = useTextos().agenda.vista
  const toque = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className={computador ? estilos.franjaPc : estilos.franja}
      onTouchStart={(e) => {
        toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const inicio = toque.current
        toque.current = null
        if (!inicio || !onSemana) return
        const dx = e.changedTouches[0].clientX - inicio.x
        const dy = e.changedTouches[0].clientY - inicio.y
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) onSemana(dx < 0 ? 1 : -1)
      }}
    >
      {dias.map((dia, i) => {
        const esHoy = dia === hoy
        const largo = conMayuscula(diaLargo(dia))
        return (
          <button
            key={dia}
            type="button"
            className={estilos.dia}
            aria-pressed={dia === elegido}
            aria-current={esHoy ? 'date' : undefined}
            aria-label={esHoy ? tv.hoyEs(diaLargo(dia)) : largo}
            disabled={!enElViaje(dia, viaje)}
            onClick={() => onElegir(dia)}
          >
            <span className={estilos.etiqueta}>{esHoy ? tv.hoy : tv.diasCortos[i]}</span>
            <span className={estilos.numero}>{Number(dia.slice(8))}</span>
          </button>
        )
      })}
    </div>
  )
}

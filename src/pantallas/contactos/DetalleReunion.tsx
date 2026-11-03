import { Icono } from '../../componentes/Icono.tsx'
import { usePersonas } from '../../datos/consultas.ts'
import { useNotasReunion, type Evento } from '../../datos/eventos.ts'
import { conMayuscula, diaCorto, diaEn, diaLargo, diaLocal, hora, hoyAqui, hoyEnCalifornia } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleReunion.module.css'

// La reunión con el contacto, que lleva a su boleto en la Agenda. Cuando ya fue, abajo van las notas que escribieron
// los que fueron (la tuya primero).
export function DetalleReunion({ reunion, hecha, yo, onAbrir }: { reunion: Evento; hecha: boolean; yo: string; onAbrir: () => void }) {
  const textos = useTextos()
  const t = textos.contactos
  const d = t.detalle
  const { data: notas } = useNotasReunion()
  const { data: personas } = usePersonas()
  const dia = diaEn(reunion.inicio)
  const cuando = d.cuando(conMayuscula(dia === hoyEnCalifornia() ? d.hoy : diaLargo(dia)), hora(reunion.inicio))
  const escritas = hecha
    ? (notas ?? [])
        .filter((n) => n.evento === reunion.id && (n.aprendi?.trim() || n.sigue?.trim()))
        .sort((a, b) => (a.autor === yo ? -1 : b.autor === yo ? 1 : a.escrita_en.localeCompare(b.escrita_en)))
    : []
  const autor = (id: string) => {
    if (id === yo) return t.tu
    const persona = personas?.find((p) => p.id === id)
    return persona ? primerNombre(persona) : ''
  }
  const escritaEl = (momento: string) => {
    const el = diaLocal(momento)
    return el === hoyAqui() ? d.hoy : diaCorto(el)
  }

  return (
    <div className={estilos.reunion}>
      <span className={estilos.rotulo}>{d.reunion}</span>
      <button type="button" className={estilos.evento} onClick={onAbrir}>
        <span className={estilos.icono}>
          <Icono nombre="agenda" medida={20} />
        </span>
        <span className={estilos.texto}>
          <span className={estilos.titulo}>{reunion.titulo}</span>
          <span className={estilos.cuando}>{cuando}</span>
        </span>
        <span className={estilos.icono}>
          <Icono nombre="derecha" medida={18} trazo={2} />
        </span>
      </button>
      {escritas.map((n) => (
        <div key={n.autor} className={estilos.nota}>
          {n.aprendi?.trim() && (
            <>
              <div className={estilos.etiqueta}>{d.queAprendiste}</div>
              <div className={estilos.parrafo}>{n.aprendi}</div>
            </>
          )}
          {n.sigue?.trim() && (
            <>
              <div className={estilos.etiqueta} data-segunda={Boolean(n.aprendi?.trim())}>
                {d.queSigue}
              </div>
              <div className={estilos.parrafo}>{n.sigue}</div>
            </>
          )}
          <div className={estilos.meta}>{d.autorYDia(autor(n.autor), escritaEl(n.escrita_en))}</div>
        </div>
      ))}
    </div>
  )
}

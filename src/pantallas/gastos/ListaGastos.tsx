import { Icono } from '../../componentes/Icono.tsx'
import { conMayuscula, diaDeLaSemana, diaLargo, sumarDias } from '../../datos/fechas.ts'
import { conmigo, plata, type Gasto, type Parte } from '../../datos/gastos.ts'
import { useTextos } from '../../textos.ts'
import { iconoDe } from './categorias.ts'
import estilos from './ListaGastos.module.css'

type Props = {
  gastos: Gasto[]
  partes: Parte[]
  yo: string
  nombres: Map<string, string>
  hoy: string
  computador: boolean
  elegido?: string
  onAbrir: (gasto: Gasto) => void
}

// Los gastos por día, del más nuevo al más viejo: quién pagó y, a la derecha, qué es para ti
export function ListaGastos({ gastos, partes, yo, nombres, hoy, computador, elegido, onAbrir }: Props) {
  const textos = useTextos()
  const tl = textos.gastos.lista
  const dias = new Map<string, Gasto[]>()
  for (const g of gastos) {
    const delDia = dias.get(g.fecha)
    if (delDia) delDia.push(g)
    else dias.set(g.fecha, [g])
  }
  // "Hoy", "Ayer" o "Domingo 10"; de otro mes, con el mes
  const tituloDia = (dia: string) => {
    if (dia === hoy) return tl.hoy
    if (dia === sumarDias(hoy, -1)) return tl.ayer
    if (dia === sumarDias(hoy, 1)) return tl.manana
    return conMayuscula(dia.slice(0, 7) === hoy.slice(0, 7) ? diaDeLaSemana(dia) : diaLargo(dia))
  }

  return (
    <div className={computador ? estilos.pc : undefined}>
      {[...dias].map(([dia, delDia]) => (
        <section key={dia} className={estilos.dia}>
          <h2 className={estilos.titulo}>{tituloDia(dia)}</h2>
          {delDia.map((g) => {
            const c = conmigo(g, partes, yo)
            const monto = plata(g.monto)
            return (
              <button key={g.id} type="button" className={estilos.fila} aria-pressed={computador ? elegido === g.id : undefined} onClick={() => onAbrir(g)}>
                <span className={estilos.icono}>
                  <Icono nombre={iconoDe(g.categoria)} medida={22} />
                </span>
                <span className={estilos.texto}>
                  <span className={estilos.nombreFila}>
                    <span className={estilos.nombre}>{g.titulo}</span>
                    {c.tipo === 'solotuyo' && (
                      <span className={estilos.candado}>
                        <Icono nombre="candado" medida={13} trazo={computador ? 2 : 2.25} />
                      </span>
                    )}
                  </span>
                  <span className={estilos.quien}>{g.pagado_por === yo ? tl.pagaste(monto) : tl.pago(nombres.get(g.pagado_por) ?? tl.alguien, monto)}</span>
                </span>
                <span className={estilos.conmigo} data-tipo={c.tipo}>
                  <span className={estilos.etiqueta}>{tl.conmigo[c.tipo]}</span>
                  {(c.tipo === 'prestaste' || c.tipo === 'teprestaron') && <span className={estilos.monto}>{plata(c.monto)}</span>}
                </span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}

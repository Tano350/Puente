import type { Persona } from '../datos/consultas.ts'
import { indiceEnElViaje, mesesDe, type Ventana } from '../datos/fechas.ts'
import { useTextos } from '../textos.ts'
import estilos from './Histograma.module.css'

type Estadia = Pick<Persona, 'llega' | 'vuelve'>

// Cuántos del grupo están allá cada día del viaje (la ventana), y tu estadía debajo
export function Histograma({ otros, llega, vuelve, ventana }: { otros: Estadia[]; llega: string | null; vuelve: string | null; ventana: Ventana }) {
  const { fechas: textos } = useTextos()
  const conFechas = otros.filter((p) => p.llega && p.vuelve)
  const escala = Math.max(conFechas.length, 1)
  const desde = llega ? indiceEnElViaje(llega, ventana) : -1
  const hasta = vuelve ? indiceEnElViaje(vuelve, ventana) : -1
  const dias = Array.from({ length: ventana.dias }, (_, i) => {
    const presentes = conFechas.filter((p) => indiceEnElViaje(p.llega!, ventana) <= i && i <= indiceEnElViaje(p.vuelve!, ventana)).length
    return { alto: Math.max(1, Math.round((presentes / escala) * 36)), tuyo: i >= desde && i <= hasta }
  })
  const izquierda = Math.max(desde, 0)
  const ancho = desde >= 0 && hasta >= desde ? Math.min(hasta, ventana.dias - 1) - izquierda + 1 : 0

  return (
    <div className={estilos.caja}>
      <div className={estilos.meses}>
        {mesesDe(ventana).map((mes) => (
          <span key={mes.nombre} style={{ flex: mes.dias }}>{mes.dias < 7 ? '' : mes.dias < 20 ? mes.nombre.slice(0, 3) : mes.nombre}</span>
        ))}
      </div>
      <div className={estilos.fila}>
        <span className={estilos.etiqueta}>{textos.grupo}</span>
        <div role="img" aria-label={textos.grafico} className={estilos.barras}>
          {dias.map((dia, i) => (
            <span key={i} className={estilos.barra} style={{ height: dia.alto }} data-tuyo={dia.tuyo} />
          ))}
        </div>
      </div>
      <div className={estilos.tuFila}>
        <span className={estilos.tu}>{textos.tu}</span>
        <span className={estilos.pista}>
          {ancho > 0 && (
            <span className={estilos.tuBarra} style={{ left: `${(izquierda / ventana.dias) * 100}%`, width: `${(ancho / ventana.dias) * 100}%` }} />
          )}
        </span>
      </div>
    </div>
  )
}

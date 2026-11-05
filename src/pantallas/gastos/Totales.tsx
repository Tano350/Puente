import { plata, useGastos, usePartes } from '../../datos/gastos.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { totales, type Totales } from './TotalesDatos.ts'
import estilos from './Totales.module.css'

// "Mis gastos" y "Gastos totales": dos cifras lado a lado, cada una en su tarjeta, sobre la tarjeta de saldo
function useTotales(): Totales | null {
  const sesion = useSesion()
  const { data: gastos } = useGastos()
  const { data: partes } = usePartes()
  if (sesion.tipo !== 'dentro' || !gastos || !partes) return null
  return totales(gastos, partes, sesion.persona.id)
}

export function ResumenTotales() {
  const t = useTextos().gastos.totales
  const datos = useTotales()
  if (!datos) return null
  const cifras = [
    { rotulo: t.mios, monto: datos.mios },
    { rotulo: t.grupo, monto: datos.grupo },
  ]
  return (
    <dl className={estilos.resumen}>
      {cifras.map((c) => (
        <div key={c.rotulo} className={estilos.cifra}>
          <dt className={estilos.rotulo}>{c.rotulo}</dt>
          <dd className={estilos.monto}>{plata(c.monto)}</dd>
        </div>
      ))}
    </dl>
  )
}

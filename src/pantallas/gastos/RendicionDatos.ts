import { partesDe, useGastos, usePartes, useRendiciones, type Gasto, type Parte } from '../../datos/gastos.ts'
import { conMayuscula, diaDeLaSemana, diaLargo, hoyEnCalifornia, sumarDias } from '../../datos/fechas.ts'
import { useSesion } from '../../datos/sesion.tsx'

// La rendición: los gastos en que tienes parte, cuánto rindes de cada uno y cuáles marcaste.

export type PorRendir = { gasto: Gasto; monto: number; marcado: boolean }

// Cuánto rindes de un gasto, en centavos. La política de viático todavía no está: por ahora es tu parte (y en los
// gastos "solo", el total, que es todo tuyo). Si la política cambia, se cambia solo aquí.
export function montoQueRindes(gasto: Gasto, partes: Parte[], yo: string): number {
  if (gasto.division === 'solo') return gasto.pagado_por === yo ? gasto.monto : 0
  return partesDe(gasto.id, partes).find((p) => p.persona === yo)?.monto ?? 0
}

// Los gastos en que tienes parte, del más nuevo al más viejo (como llegan); null mientras se cargan
export function usePorRendir(): PorRendir[] | null {
  const sesion = useSesion()
  const { data: gastos } = useGastos()
  const { data: partes } = usePartes()
  const { data: rendiciones } = useRendiciones()
  if (sesion.tipo !== 'dentro' || !gastos || !partes || !rendiciones) return null
  const yo = sesion.persona.id
  const rindo = new Set(rendiciones.filter((r) => r.persona === yo).map((r) => r.gasto))
  return gastos.flatMap((gasto) => {
    const monto = montoQueRindes(gasto, partes, yo)
    return monto > 0 ? [{ gasto, monto, marcado: rindo.has(gasto.id) }] : []
  })
}

// Lo marcado: cuántos, cuánto suman y cuántos no tienen foto de la boleta
export function resumir(lista: PorRendir[]): { marcados: PorRendir[]; total: number; sinFoto: number } {
  const marcados = lista.filter((x) => x.marcado)
  return {
    marcados,
    total: marcados.reduce((suma, x) => suma + x.monto, 0),
    sinFoto: marcados.filter((x) => !x.gasto.boleta).length,
  }
}

// Como en la lista: "Hoy", "Ayer" o "Domingo 10"; de otro mes, "Martes 5 de enero"
export function diaDelGasto(fecha: string, nombres: { hoy: string; ayer: string; manana: string }, hoy = hoyEnCalifornia()): string {
  if (fecha === hoy) return nombres.hoy
  if (fecha === sumarDias(hoy, -1)) return nombres.ayer
  if (fecha === sumarDias(hoy, 1)) return nombres.manana
  return conMayuscula(fecha.slice(0, 7) === hoy.slice(0, 7) ? diaDeLaSemana(fecha) : diaLargo(fecha))
}

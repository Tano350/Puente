import { useMemo } from 'react'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { comoSaldar, saldos, useGastos, usePagos, usePartes, type Gasto, type Pago, type Parte, type Transferencia } from '../../datos/gastos.ts'
import { integrantes } from '../../datos/grupo.ts'
import { nombreCompleto, primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'

// Las cuentas de los saldos: cuánto le deben (o debe) cada uno, las transferencias que faltan y los pagos ya marcados.

export type SaldoDe = { persona: Persona; saldo: number }

export type Saldos = {
  yo: string
  // Tu saldo en centavos: positivo, te deben; negativo, debes
  mio: number
  // Los del grupo (y quien ya no está pero quedó con saldo), del que más le deben al que más debe
  gente: SaldoDe[]
  // Las que faltan, las tuyas primero y después de la más grande a la más chica
  pendientes: Transferencia[]
  // Lo que transfieres tú y lo que te transfieren, de lo más grande a lo más chico
  debes: Transferencia[]
  teDeben: Transferencia[]
  // Lo que puedes marcar como pagado: lo que debes a alguien que sigue en el grupo
  pagables: Transferencia[]
  // Los pagos marcados, del más viejo al más nuevo, y el último tuyo
  hechos: Pago[]
  ultimoTuyo: Pago | null
  persona: (id: string) => Persona | undefined
  // "Tú" para ti; si no, el primer nombre (el completo si otro del grupo se llama igual)
  nombre: (id: string) => string
}

export function useSaldos(): Saldos | null {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: gastos } = useGastos()
  const { data: partes } = usePartes()
  const { data: pagos } = usePagos()
  const { data: personas } = usePersonas()
  const yo = sesion.tipo === 'dentro' ? sesion.persona : null
  return useMemo(
    () => (yo && gastos && partes && pagos && personas ? calcular(yo, gastos, partes, pagos, personas, textos) : null),
    [yo, gastos, partes, pagos, personas, textos],
  )
}

function calcular(yo: Persona, gastos: Gasto[], partes: Parte[], pagos: Pago[], personas: Persona[], textos: Textos): Saldos {
  // Tu fila sale de la sesión, que tiene lo último que guardaste
  const todas = [yo, ...personas.filter((p) => p.id !== yo.id)]
  const porId = new Map(todas.map((p) => [p.id, p]))
  const saldo = saldos(gastos, partes, pagos, integrantes(todas, yo.id).map((p) => p.id))
  const de = (id: string) => saldo[id] ?? 0

  const visibles = todas.filter((p) => !p.sacada_en || de(p.id) !== 0)
  const repetidos = new Set(visibles.map(primerNombre).filter((n, i, lista) => lista.indexOf(n) !== i))
  const nombre = (id: string) => {
    if (id === yo.id) return textos.gastos.tu
    const p = porId.get(id)
    if (!p) return textos.gastos.saldos.alguien
    return repetidos.has(primerNombre(p)) ? nombreCompleto(p) : primerNombre(p)
  }
  const gente = visibles
    .map((p) => ({ persona: p, saldo: de(p.id) }))
    .sort((a, b) => b.saldo - a.saldo || nombre(a.persona.id).localeCompare(nombre(b.persona.id), 'es'))

  // Mientras se recarga, un gasto y sus partes pueden llegar a destiempo: si los saldos no cuadran, todavía no hay transferencias
  const cuadra = Object.values(saldo).reduce((suma, x) => suma + x, 0) === 0
  const tuya = (x: Transferencia) => x.de === yo.id || x.a === yo.id
  const porMonto = (a: Transferencia, b: Transferencia) => b.monto - a.monto || nombre(a.de).localeCompare(nombre(b.de), 'es')
  const pendientes = (cuadra ? comoSaldar(saldo) : []).sort((a, b) => Number(tuya(b)) - Number(tuya(a)) || porMonto(a, b))
  const debes = pendientes.filter((x) => x.de === yo.id)
  const hechos = [...pagos].sort((a, b) => a.creado_en.localeCompare(b.creado_en))

  return {
    yo: yo.id,
    mio: de(yo.id),
    gente,
    pendientes,
    debes,
    teDeben: pendientes.filter((x) => x.a === yo.id),
    pagables: debes.filter((x) => {
      const p = porId.get(x.a)
      return p !== undefined && !p.sacada_en
    }),
    hechos,
    ultimoTuyo: hechos.findLast((p) => p.de === yo.id) ?? null,
    persona: (id) => porId.get(id),
    nombre,
  }
}

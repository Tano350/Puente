import { useState } from 'react'
import { Buscador } from '../../componentes/Buscador.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import type { Persona } from '../../datos/consultas.ts'
import { plata } from '../../datos/gastos.ts'
import { coincide } from '../../datos/grupo.ts'
import { useTextos } from '../../textos.ts'
import { ordenarMonto, soloMonto, type Borrador, type Cuenta, type Errores } from './AnotarBorrador.ts'
import estilos from './AnotarEntreQuienes.module.css'

type Props = {
  computador: boolean
  borrador: Borrador
  cuenta: Cuenta
  gente: Persona[]
  nombres: Map<string, string>
  yo: string
  errores: Errores
  onCambio: (cambios: Partial<Borrador>, soloFormato?: boolean) => void
}

type Tono = 'sec' | 'enContra' | 'aFavor' | 'error'

// "Entre quiénes": las 14 personas con su casilla y su parte. El buscador filtra sin perder a los marcados.
// En montos exactos cada marcado tiene su campo y la línea de arriba dice cuánto falta, cuánto sobra o que suma bien.
export function AnotarEntreQuienes({ computador, borrador, cuenta, gente, nombres, yo, errores, onCambio }: Props) {
  const textos = useTextos()
  const tg = textos.gastos
  const t = tg.anotar
  const [busqueda, setBusqueda] = useState('')
  const solo = borrador.division === 'solo'
  const exactos = borrador.division === 'exactos'
  const buscando = busqueda.trim() !== ''
  const visibles = gente.filter((p) => coincide(p, busqueda))
  const n = cuenta.marcados.length
  const todos = n === gente.length

  // La línea de resumen; con un error, lo dice en su lugar
  let nota: { texto: string; tono: Tono; check?: boolean } = { texto: t.nadie, tono: 'sec' }
  if (errores.personas) nota = { texto: errores.personas, tono: 'error' }
  else if (n > 0 && !exactos) nota = { texto: t.cadaUna(n, plata(Math.floor((cuenta.total ?? 0) / n))), tono: 'sec' }
  else if (n > 0) {
    const total = cuenta.total ?? 0
    const tono = errores.cuadra ? 'error' : 'enContra'
    if (!total) nota = { texto: t.suma(plata(cuenta.suma)), tono: 'sec' }
    else if (cuenta.suma < total) nota = { texto: t.faltan(plata(total - cuenta.suma)), tono }
    else if (cuenta.suma > total) nota = { texto: t.tePasaste(plata(cuenta.suma - total)), tono }
    else nota = { texto: t.suma(plata(total)), tono: 'aFavor', check: true }
  }
  const alerta = nota.tono === 'error'

  const marcar = (persona: string, si: boolean) => onCambio({ elegidos: si ? [...borrador.elegidos, persona] : borrador.elegidos.filter((id) => id !== persona) })
  const escribir = (persona: string, texto: string, soloFormato = false) => onCambio({ exactos: { ...borrador.exactos, [persona]: texto } }, soloFormato)

  return (
    <div id="anotar-entre" role="group" aria-labelledby="anotar-entre-titulo" className={estilos.lista} data-computador={computador}>
      <div className={estilos.cabeza}>
        <span id="anotar-entre-titulo" className={estilos.titulo}>
          {t.entreQuienes}
        </span>
        {!solo && !buscando && (
          <button type="button" className={estilos.todos} onClick={() => onCambio({ elegidos: todos ? [] : gente.map((p) => p.id) })}>
            {todos ? t.ninguno : t.todos}
          </button>
        )}
      </div>

      {solo ? (
        <div className={estilos.solo}>
          <Icono nombre="candado" medida={18} trazo={2} />
          {t.soloTu}
        </div>
      ) : (
        <>
          <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscador} />
          <div id="anotar-nota" role={alerta ? 'alert' : 'status'} className={estilos.nota} data-tono={nota.tono}>
            {alerta && <Icono nombre="alerta" medida={15} trazo={2} />}
            {nota.check && <Icono nombre="check" medida={15} trazo={2.5} />}
            {nota.texto}
          </div>
          <div className={estilos.personas}>
            {visibles.map((p) => {
              const tuyo = p.id === yo
              const nombre = tuyo ? tg.tu : (nombres.get(p.id) ?? '')
              const marcado = cuenta.marcados.includes(p.id)
              const campo = exactos && marcado
              const parte = cuenta.partes.find((x) => x.persona === p.id)?.monto ?? 0
              const malo = errores.partes?.includes(p.id) ?? false
              return (
                <div key={p.id} className={estilos.fila}>
                  <label className={estilos.persona}>
                    <input type="checkbox" className={estilos.nativa} checked={marcado} onChange={(e) => marcar(p.id, e.target.checked)} />
                    <span className={estilos.casilla} aria-hidden="true">
                      <Icono nombre="check" medida={14} trazo={3} />
                    </span>
                    <span className={estilos.nombre} data-tu={tuyo}>
                      {nombre}
                    </span>
                    {!campo && (
                      <span className={estilos.parte} data-marcado={marcado}>
                        {marcado ? plata(parte) : '—'}
                      </span>
                    )}
                  </label>
                  {/* El campo se ve de 30 px; tocar en todo el alto de la fila también lo enfoca */}
                  {campo && (
                    <label className={estilos.campoToque}>
                      <input
                        id={`anotar-parte-${p.id}`}
                        className={estilos.campo}
                        value={borrador.exactos[p.id] ?? ''}
                        placeholder="0,00"
                        inputMode="decimal"
                        autoComplete="off"
                        maxLength={13}
                        aria-label={tuyo ? t.tuParte : t.parteDe(nombre)}
                        aria-invalid={malo}
                        aria-describedby="anotar-nota"
                        onChange={(e) => escribir(p.id, soloMonto(e.target.value))}
                        onBlur={(e) => {
                          const ordenado = ordenarMonto(e.target.value)
                          if (ordenado !== e.target.value) escribir(p.id, ordenado, true)
                        }}
                      />
                    </label>
                  )}
                </div>
              )
            })}
            {visibles.length === 0 && <div className={estilos.nadie}>{textos.nadieCoincide(busqueda.trim())}</div>}
          </div>
        </>
      )}
    </div>
  )
}

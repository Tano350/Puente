import { useState } from 'react'
import { useLocation } from 'react-router'
import { Avatar } from '../../componentes/Avatar.tsx'
import { Aviso } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { deshacerPago, marcarPagado, plata, type Pago, type Transferencia } from '../../datos/gastos.ts'
import { useTextos, type Textos } from '../../textos.ts'
import { Flecha, Saldar } from './Saldar.tsx'
import { useSaldos, type Saldos } from './SaldosDatos.ts'
import estilos from './Saldos.module.css'

// Los saldos: tu tarjeta ("Debes US$ 84,00 · A Diego" con "Saldar", "Te deben" o "Estás al día"), los saldos de todos
// y "Cómo saldar". En el celular, la tarjeta va arriba de la lista y lo demás en la pestaña Saldos; en el computador,
// la tarjeta y los saldos van siempre a la derecha. Ninguna pieza trae margen por fuera: lo pone quien las ubica.

// En las listas todo es en dólares, así que los montos van sin "US$"
const sinMoneda = (centavos: number) => plata(Math.abs(centavos)).replace('US$ ', '')
const signo = (centavos: number) => (centavos > 0 ? 'mas' : centavos < 0 ? 'menos' : 'cero')

type Situacion = { tipo: 'debes' | 'teDeben' | 'alDia'; titulo: string; monto: number; detalle: string | null }

// Lo que dice tu tarjeta: cuánto debes y a quiénes, cuánto te deben y quiénes, o que estás al día (con tu último pago)
function situacion(datos: Saldos, textos: Textos, compacta: boolean): Situacion {
  const t = textos.gastos.saldos
  // Hasta dos nombres ("Diego y Martina"); si son más, cuántos
  const quienes = (ids: string[]) => (ids.length > 2 ? t.personas(ids.length) : textos.y(ids.map(datos.nombre)))
  if (datos.mio < 0) {
    const a = datos.debes.map((x) => x.a)
    const detalle = a.length === 0 ? null : compacta ? t.transfierele(quienes(a), a.length > 1) : t.a(quienes(a))
    return { tipo: 'debes', titulo: t.debes, monto: -datos.mio, detalle }
  }
  if (datos.mio > 0) {
    const de = datos.teDeben.map((x) => x.de)
    return { tipo: 'teDeben', titulo: t.teDeben, monto: datos.mio, detalle: de.length === 0 ? null : t.teTransfieren(quienes(de), de.length > 1) }
  }
  const ultimo = datos.ultimoTuyo
  return { tipo: 'alDia', titulo: t.alDia, monto: 0, detalle: ultimo ? t.transferiste(plata(ultimo.monto), datos.nombre(ultimo.a)) : null }
}

// Los billetes de la tarjeta de la pestaña Saldos
function Billetes() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM12 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

// Tu tarjeta, con "Saldar" (hoja o panel) y su aviso. La de arriba de la lista lleva el monto grande a la derecha;
// la de la pestaña Saldos ("compacta") es una fila con ícono y un "Saldar" chico.
function Tarjeta({ datos, computador, compacta = false }: { datos: Saldos; computador: boolean; compacta?: boolean }) {
  const textos = useTextos()
  const t = textos.gastos.saldos
  const aviso = useAviso()
  const location = useLocation()
  const [saldando, setSaldando] = useState(false)
  const [marcando, setMarcando] = useState<Transferencia | null>(null)
  const [donde, setDonde] = useState(location.key)
  const puedeSaldar = datos.mio < 0 && datos.pagables.length > 0
  // Se abre un panel a la vez: abrir un gasto, anotar uno o la rendición (todos cambian la dirección) cierra "Saldar"
  if (donde !== location.key) {
    setDonde(location.key)
    setSaldando(false)
  }
  // Si ya no queda nada que saldar (alguien cambió un gasto), "Saldar" no queda pendiente de volver a abrirse solo
  if (saldando && !marcando && !puedeSaldar) setSaldando(false)
  const s = situacion(datos, textos, compacta)

  // "Deshacer" borra el pago recién marcado
  const deshacer = async (pago: Pago) => {
    aviso.cerrar()
    try {
      await deshacerPago(pago.id)
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  const marcar = async (transferencia: Transferencia) => {
    setMarcando(transferencia)
    try {
      const pago = await marcarPagado(transferencia.a, transferencia.monto)
      aviso.mostrar(t.pagaste(datos.nombre(transferencia.a)), () => void deshacer(pago))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
    setMarcando(null)
    setSaldando(false)
  }

  const saldar = (
    <button type="button" className={compacta ? estilos.saldarChico : estilos.saldar} onClick={() => setSaldando(true)}>
      {t.saldar}
    </button>
  )
  return (
    <>
      {compacta ? (
        <div className={estilos.compacta}>
          <span className={estilos.icono}>
            <Billetes />
          </span>
          <div className={estilos.situacion}>
            <div className={estilos.titulo}>
              {s.titulo}
              {s.monto > 0 && (
                <>
                  {' '}
                  <span className={estilos.montoEnTitulo} data-tipo={s.tipo}>
                    {plata(s.monto)}
                  </span>
                </>
              )}
            </div>
            {s.detalle && <div className={estilos.detalle}>{s.detalle}</div>}
          </div>
          {puedeSaldar && saldar}
        </div>
      ) : (
        <div className={estilos.tarjeta} data-computador={computador}>
          <div className={estilos.fila}>
            <div className={estilos.situacion}>
              <div className={estilos.titulo}>{s.titulo}</div>
              {s.detalle && <div className={estilos.detalle}>{s.detalle}</div>}
            </div>
            {s.monto > 0 && (
              <div className={estilos.monto} data-tipo={s.tipo}>
                {plata(s.monto)}
              </div>
            )}
          </div>
          {puedeSaldar && saldar}
        </div>
      )}
      {saldando && <Saldar datos={datos} computador={computador} marcando={marcando} onMarcar={(x) => void marcar(x)} onCerrar={() => setSaldando(false)} />}
      {/* En el celular, sobre el botón "Anotar gasto"; en el computador, centrado en la lista (la columna de la derecha queda a la vista) */}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={!computador} conPanel={computador} />
    </>
  )
}

// Los saldos de todos, del que más le deben al que más debe: "+171,90" en verde, "−9,40" en naranja o "Al día"
function ListaSaldos({ datos, enColumna }: { datos: Saldos; enColumna: boolean }) {
  const textos = useTextos()
  return (
    <div className={enColumna ? estilos.columna : undefined}>
      <h2 className={estilos.rotulo}>{textos.gastos.saldos.titulo}</h2>
      <ul className={estilos.lista}>
        {datos.gente.map(({ persona, saldo }) => {
          const tuyo = persona.id === datos.yo
          return (
            <li key={persona.id} className={estilos.persona}>
              {tuyo ? (
                <span className={estilos.tuAvatar} aria-hidden="true">
                  {textos.gastos.tu}
                </span>
              ) : (
                <Avatar persona={persona} medida={enColumna ? 28 : 34} />
              )}
              <span className={estilos.nombre} data-tu={tuyo}>
                {datos.nombre(persona.id)}
              </span>
              <span className={estilos.saldo} data-signo={signo(saldo)}>
                {saldo === 0 ? textos.gastos.saldos.alDiaCorto : `${saldo > 0 ? '+' : '−'}${sinMoneda(saldo)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Las transferencias que faltan (las tuyas primero, marcadas) y, después, las ya pagadas con un check
function ComoSaldar({ datos }: { datos: Saldos }) {
  const textos = useTextos()
  const t = textos.gastos.saldos
  if (datos.pendientes.length === 0 && datos.hechos.length === 0) return null
  // Para lectores de pantalla va la frase entera ("Le transfieres US$ 84,00 a Diego."); la flecha es solo para la vista
  const quien = (id: string) => (id === datos.yo ? null : datos.nombre(id))
  const fila = (clave: string, de: string, a: string, monto: number, hecha: boolean) => (
    <li key={clave} className={estilos.transferencia} data-tuya={de === datos.yo || a === datos.yo} data-hecha={hecha}>
      <span className={estilos.oculto}>{t.frase(quien(de), quien(a), plata(monto), hecha)}</span>
      <span className={estilos.quienes} aria-hidden="true">
        <span className={estilos.quien}>{datos.nombre(de)}</span>
        <span className={estilos.flecha}>
          <Flecha medida={16} />
        </span>
        <span className={estilos.quien}>{datos.nombre(a)}</span>
      </span>
      <span className={estilos.cuanto} aria-hidden="true">
        {sinMoneda(monto)}
      </span>
      <span className={estilos.marca} aria-hidden="true">
        {hecha && <Icono nombre="check" medida={18} trazo={2.5} />}
      </span>
    </li>
  )
  return (
    <>
      <h2 className={estilos.rotulo}>{t.comoSaldar}</h2>
      {datos.pendientes.length > 0 && <p className={estilos.nota}>{t.menosTransferencias}</p>}
      <ul className={estilos.transferencias}>
        {datos.pendientes.map((x) => fila(`${x.de}-${x.a}`, x.de, x.a, x.monto, false))}
        {datos.hechos.map((p) => fila(p.id, p.de, p.a, p.monto, true))}
      </ul>
    </>
  )
}

// Tu situación: va arriba de la lista en el celular y arriba de la columna de la derecha en el computador.
// "Saldar" abre su hoja y, al marcar el pago, muestra su aviso con "Deshacer".
export function TarjetaSaldo({ computador }: { computador: boolean }) {
  const datos = useSaldos()
  if (!datos) return null
  return <Tarjeta datos={datos} computador={computador} />
}

// En el celular, la pestaña Saldos: tu tarjeta, los saldos de todos y "Cómo saldar".
// En el computador, con "enColumna", los saldos de todos que van siempre a la derecha, bajo tu tarjeta.
export function VistaSaldos({ computador, enColumna = false }: { computador: boolean; enColumna?: boolean }) {
  const datos = useSaldos()
  if (!datos) return null
  if (enColumna) return <ListaSaldos datos={datos} enColumna />
  return (
    <div>
      <Tarjeta datos={datos} computador={computador} compacta />
      <ListaSaldos datos={datos} enColumna={false} />
      <ComoSaldar datos={datos} />
    </div>
  )
}

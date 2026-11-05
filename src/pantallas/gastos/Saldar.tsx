import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../../componentes/Avatar.tsx'
import { BotonBorde, BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { PanelEncima } from '../../componentes/Paneles.tsx'
import { plata, type Transferencia } from '../../datos/gastos.ts'
import { useTextos } from '../../textos.ts'
import type { Saldos } from './SaldosDatos.ts'
import estilos from './Saldar.module.css'

// La flecha de "Tú → Diego" (también la usan las transferencias de "Cómo saldar")
export function Flecha({ medida }: { medida: number }) {
  return (
    <svg width={medida} height={medida} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M5 12h14M13 6l6 6l-6 6" />
    </svg>
  )
}

type Props = {
  datos: Saldos
  computador: boolean
  // La que se está marcando: se sigue mostrando aunque los saldos se recarguen
  marcando: Transferencia | null
  onMarcar: (transferencia: Transferencia) => void
  onCerrar: () => void
}

// "Saldar", como "registrar un pago" de Splitwise: transfieres desde tu banco y aquí lo marcas como pagado.
// Si le debes a más de una persona, cada transferencia se marca por separado: arriba eliges a quién.
// Se monta al abrirse: en el celular es una hoja; en el computador, el panel encima de la columna de la derecha
// (se ubica contra el cuerpo de la pantalla, porque la columna no se posiciona).
export function Saldar({ datos, computador, marcando, onMarcar, onCerrar }: Props) {
  const textos = useTextos()
  const t = textos.gastos.saldos
  const [elegido, setElegido] = useState<string | null>(null)
  const contenido = useRef<HTMLDivElement>(null)
  const actual = marcando ?? datos.pagables.find((x) => x.a === elegido) ?? datos.pagables[0]
  const para = actual ? datos.persona(actual.a) : undefined
  const visible = para !== undefined

  // Al abrirse, el foco entra; al cerrarse vuelve a "Saldar", si sigue ahí (en el celular eso lo hace la hoja)
  useEffect(() => {
    if (!visible) return
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    contenido.current?.focus({ preventScroll: true })
    return () => {
      if (computador && antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [visible, computador])

  if (!actual || !para) return null
  const cuerpo = (
    <div ref={contenido} tabIndex={-1} className={estilos.contenido} data-computador={computador}>
      {!computador && <TituloHoja>{t.saldar}</TituloHoja>}
      {datos.pagables.length > 1 && (
        <div role="group" aria-label={t.aQuien} className={estilos.quienes}>
          {datos.pagables.map((x) => (
            <button key={x.a} type="button" aria-pressed={x.a === actual.a} className={estilos.quien} onClick={() => setElegido(x.a)}>
              {datos.nombre(x.a)}
            </button>
          ))}
        </div>
      )}
      <div className={estilos.flujo} aria-hidden="true">
        <span className={estilos.tu}>{textos.gastos.tu}</span>
        <Flecha medida={26} />
        <Avatar persona={para} medida={56} />
      </div>
      <div className={estilos.lePagas}>{t.lePagas(datos.nombre(actual.a))}</div>
      <div className={estilos.monto}>{plata(actual.monto)}</div>
      <div className={estilos.explica}>{t.explica}</div>
      <div className={estilos.marcar}>
        <BotonPrincipal ocupado={marcando !== null} onClick={() => onMarcar(actual)}>
          {t.marcarPagado}
        </BotonPrincipal>
      </div>
      {computador ? (
        <div className={estilos.cancelarBorde}>
          <BotonBorde onClick={onCerrar}>{textos.cancelar}</BotonBorde>
        </div>
      ) : (
        <button type="button" className={estilos.cancelar} onClick={onCerrar}>
          {textos.cancelar}
        </button>
      )}
    </div>
  )

  if (computador) {
    return (
      <PanelEncima etiqueta={t.saldar} cabecera={<h2 className={estilos.tituloPanel}>{t.saldar}</h2>} onCerrar={onCerrar}>
        {cuerpo}
      </PanelEncima>
    )
  }
  return (
    <Hoja abierta etiqueta={t.saldar} onCerrar={onCerrar}>
      {cuerpo}
    </Hoja>
  )
}

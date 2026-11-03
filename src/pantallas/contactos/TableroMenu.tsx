import { useEffect, useId, useRef, useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './TableroMenu.module.css'

type Props<T extends string> = { etiqueta: string; opciones: { valor: T; texto: string }[]; elegidas: T[]; onCambiar: (elegidas: T[]) => void }

// Computador: "Estado" y "Responsable" se despliegan con las mismas opciones que la hoja del celular, y filtran al tiro
export function TableroMenu<T extends string>({ etiqueta, opciones, elegidas, onCambiar }: Props<T>) {
  const textos = useTextos()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const idMenu = useId()

  // Se cierra al hacer clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    document.addEventListener('pointerdown', afuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', afuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const alternar = (valor: T) => onCambiar(elegidas.includes(valor) ? elegidas.filter((v) => v !== valor) : [...elegidas, valor])

  return (
    <div ref={caja} className={estilos.caja}>
      <button ref={boton} type="button" className={estilos.boton} aria-expanded={abierto} aria-controls={idMenu} onClick={() => setAbierto(!abierto)}>
        {etiqueta}
        {elegidas.length > 0 && <span className={estilos.cuenta}>{elegidas.length}</span>}
        <Icono nombre="abajo" medida={16} trazo={2} />
      </button>
      {abierto && (
        <div id={idMenu} role="group" aria-label={etiqueta} className={estilos.menu}>
          {opciones.map((o) => {
            const elegida = elegidas.includes(o.valor)
            return (
              <button key={o.valor} type="button" className={estilos.opcion} aria-pressed={elegida} onClick={() => alternar(o.valor)}>
                <span className={estilos.casilla} aria-hidden="true">
                  {elegida && <Icono nombre="check" medida={14} trazo={2.5} />}
                </span>
                {o.texto}
              </button>
            )
          })}
          {elegidas.length > 0 && (
            <button type="button" className={estilos.limpiar} onClick={() => onCambiar([])}>
              {textos.contactos.lista.limpiar}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

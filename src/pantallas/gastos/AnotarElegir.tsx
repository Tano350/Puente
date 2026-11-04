import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Buscador } from '../../componentes/Buscador.tsx'
import { Hoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import type { Persona } from '../../datos/consultas.ts'
import { CATEGORIAS, type Categoria } from '../../datos/gastos.ts'
import { coincide } from '../../datos/grupo.ts'
import { useTextos } from '../../textos.ts'
import { iconoDe } from './categorias.ts'
import estilos from './AnotarElegir.module.css'

type PropsMenu = { computador: boolean; abierto: boolean; titulo: string; clase: string; onCerrar: () => void; children: ReactNode }

// Elegir algo del gasto: en el celular, una hoja con "Cancelar"; en el computador, un menú bajo lo que lo abre
// (el botón con aria-haspopup, en el mismo contenedor que el menú, con position: relative).
function Elegir({ computador, abierto, titulo, clase, onCerrar, children }: PropsMenu) {
  const textos = useTextos()
  if (computador) return <Menu abierto={abierto} titulo={titulo} clase={clase} onCerrar={onCerrar}>{children}</Menu>
  return (
    <Hoja abierta={abierto} etiqueta={titulo} onCerrar={onCerrar}>
      <div className={estilos.hojaCabeza}>
        <h2 className={estilos.hojaTitulo}>{titulo}</h2>
        <button type="button" className={estilos.hojaCancelar} onClick={onCerrar}>
          {textos.cancelar}
        </button>
      </div>
      {children}
    </Hoja>
  )
}

function Menu({ abierto, titulo, clase, onCerrar, children }: Omit<PropsMenu, 'computador'>) {
  const caja = useRef<HTMLDivElement>(null)
  // Se cierra al tocar fuera; tocar lo que lo abrió lo cierra por su cuenta
  useEffect(() => {
    if (!abierto) return
    const alTocar = (e: PointerEvent) => {
      const disparador = caja.current?.parentElement?.querySelector('[aria-haspopup]')
      if (e.target instanceof Node && !caja.current?.contains(e.target) && !disparador?.contains(e.target)) onCerrar()
    }
    document.addEventListener('pointerdown', alTocar)
    return () => document.removeEventListener('pointerdown', alTocar)
  }, [abierto, onCerrar])
  // Al abrir, el foco va al buscador o a lo elegido; al cerrar, vuelve a lo que lo abrió (aunque el clic no le haya dado el foco)
  useEffect(() => {
    if (!abierto) return
    const antes = caja.current?.parentElement?.querySelector<HTMLElement>('[aria-haspopup]') ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    caja.current?.querySelector<HTMLElement>('input, [aria-pressed="true"]')?.focus()
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [abierto])
  // Escape cierra solo el menú; las flechas recorren el buscador y las opciones
  const alPresionar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const lista = [...(caja.current?.querySelectorAll<HTMLElement>('input, [aria-pressed]') ?? [])]
    const i = lista.indexOf(document.activeElement as HTMLElement)
    const siguiente = lista[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), lista.length - 1)]
    if (!siguiente) return
    e.preventDefault()
    siguiente.focus()
  }
  if (!abierto) return null
  return (
    <div ref={caja} role="dialog" aria-label={titulo} className={`${estilos.menu} ${clase}`} onKeyDown={alPresionar}>
      <div className={estilos.menuTitulo}>{titulo}</div>
      {children}
    </div>
  )
}

// Lo elegido, en el menú
function Marca() {
  return (
    <span className={estilos.marca}>
      <Icono nombre="check" medida={16} trazo={2.5} />
    </span>
  )
}

type PropsPago = { computador: boolean; abierto: boolean; gente: Persona[]; nombres: Map<string, string>; yo: string; elegido: string; onElegir: (persona: string) => void; onCerrar: () => void }

// "¿Quién pagó?": las 14 personas, con el buscador de siempre. Tocar a alguien lo elige y cierra; "Cancelar" no cambia nada.
export function AnotarQuienPago({ computador, abierto, gente, nombres, yo, elegido, onElegir, onCerrar }: PropsPago) {
  const textos = useTextos()
  const tg = textos.gastos
  const [busqueda, setBusqueda] = useState('')
  const visibles = gente.filter((p) => coincide(p, busqueda))
  const nombre = (p: Persona) => (p.id === yo ? tg.tu : (nombres.get(p.id) ?? ''))
  const cerrar = () => {
    setBusqueda('')
    onCerrar()
  }
  const elegir = (persona: string) => {
    setBusqueda('')
    onElegir(persona)
  }
  return (
    <Elegir computador={computador} abierto={abierto} titulo={tg.anotar.quienPago} clase={estilos.menuPago} onCerrar={cerrar}>
      {/* Enter en el buscador elige al primero que coincide */}
      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement && visibles[0]) {
            e.preventDefault()
            elegir(visibles[0].id)
          }
        }}
      >
        <Buscador valor={busqueda} onCambio={setBusqueda} clase={computador ? estilos.buscadorMenu : estilos.buscadorHoja} />
      </div>
      <div className={computador ? undefined : estilos.opciones}>
        {visibles.map((p) => {
          const tuyo = p.id === yo
          const si = p.id === elegido
          return computador ? (
            <button key={p.id} type="button" className={estilos.opcionMenu} aria-pressed={si} onClick={() => elegir(p.id)}>
              <span className={estilos.inicial} data-tu={tuyo} aria-hidden="true">
                {tuyo ? tg.tu : nombre(p).charAt(0).toUpperCase()}
              </span>
              <span className={estilos.nombreMenu}>{nombre(p)}</span>
              {si && <Marca />}
            </button>
          ) : (
            <button key={p.id} type="button" className={estilos.opcion} aria-pressed={si} onClick={() => elegir(p.id)}>
              <span className={estilos.radio} aria-hidden="true" />
              <span className={estilos.nombre} data-tu={tuyo}>
                {nombre(p)}
              </span>
            </button>
          )
        })}
        {visibles.length === 0 && <div className={estilos.nadie}>{textos.nadieCoincide(busqueda.trim())}</div>}
      </div>
    </Elegir>
  )
}

type PropsCategoria = { computador: boolean; abierto: boolean; elegida: Categoria; onElegir: (categoria: Categoria) => void; onCerrar: () => void }

// La categoría, por si la que se eligió sola no es la que corresponde
export function AnotarCategoria({ computador, abierto, elegida, onElegir, onCerrar }: PropsCategoria) {
  const textos = useTextos()
  const tg = textos.gastos
  return (
    <Elegir computador={computador} abierto={abierto} titulo={tg.anotar.categoria} clase={estilos.menuCategoria} onCerrar={onCerrar}>
      <div className={computador ? estilos.categoriasMenu : estilos.opciones}>
        {CATEGORIAS.map((c) => {
          const si = c === elegida
          return (
            <button key={c} type="button" className={computador ? estilos.opcionMenu : estilos.opcion} aria-pressed={si} onClick={() => onElegir(c)}>
              {!computador && <span className={estilos.radio} aria-hidden="true" />}
              <Icono nombre={iconoDe(c)} medida={computador ? 20 : 22} />
              <span className={computador ? estilos.nombreMenu : estilos.nombre}>{tg.categorias[c]}</span>
              {computador && si && <Marca />}
            </button>
          )
        })}
      </div>
    </Elegir>
  )
}

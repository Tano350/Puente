import { useRef } from 'react'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import estilos from './Buscador.module.css'

// El buscador de personas: el mismo en Grupo, Invitados y cada vez que hay que elegir entre los 14
export function Buscador({ valor, onCambio, clase }: { valor: string; onCambio: (valor: string) => void; clase?: string }) {
  const textos = useTextos()
  const campo = useRef<HTMLInputElement>(null)
  const borrar = () => {
    onCambio('')
    campo.current?.focus()
  }
  return (
    <div role="search" className={`${estilos.buscador} ${clase ?? ''}`} data-lleno={valor !== ''}>
      <Icono nombre="buscar" medida={18} trazo={2} />
      <input
        ref={campo}
        type="search"
        className={estilos.campo}
        value={valor}
        placeholder={textos.buscar}
        aria-label={textos.buscar}
        enterKeyHint="search"
        autoComplete="off"
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && valor) borrar()
        }}
      />
      {valor && (
        <button type="button" aria-label={textos.borrarBusqueda} className={estilos.borrar} onClick={borrar}>
          <Icono nombre="cerrar" medida={18} trazo={2} />
        </button>
      )}
    </div>
  )
}

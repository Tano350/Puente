import { useConectado } from '../datos/conexion.ts'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import estilos from './SinConexion.module.css'

// La ficha "Sin conexión" del diseño: va arriba en las pantallas y paneles mientras no hay señal; con señal no se ve.
// Sobre un panel o tarjeta (fondo de panel) usa sobrePanel, para que la ficha tome el color del fondo de la pantalla.
export function SinConexion({ sobrePanel = false }: { sobrePanel?: boolean }) {
  const conectado = useConectado()
  const textos = useTextos()
  if (conectado) return null
  return (
    <span className={estilos.ficha} data-sobre-panel={sobrePanel} role="status">
      <Icono nombre="sinSenal" medida={15} trazo={2} />
      {textos.sinConexion}
    </span>
  )
}

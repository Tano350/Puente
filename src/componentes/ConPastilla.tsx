import { useRef, type HTMLAttributes } from 'react'
import { usePastilla } from '../movimiento/index.ts'
import estilos from './ConPastilla.module.css'

// Un grupo de opciones (Todas / Mías, Día / Semana / Mes, la franja de días) cuya marca de lo elegido se desliza con
// resorte hasta la opción elegida (aria-pressed o aria-selected). La marca pone el fondo que antes tenía la opción
// elegida; su forma se cambia desde el grupo con --marca-arriba, --marca-radio y --marca-fondo.
// clave: para un selector que cambia de pantalla al elegir (se arma de nuevo en la otra); su marca parte desde donde
// quedó y se desliza igual.
export function ConPastilla({ className, children, clave, ...resto }: HTMLAttributes<HTMLDivElement> & { clave?: string }) {
  const grupo = useRef<HTMLDivElement>(null)
  usePastilla(grupo, 'x', clave)
  return (
    <div ref={grupo} className={className ? `${estilos.grupo} ${className}` : estilos.grupo} {...resto}>
      <span className={estilos.marca} data-pastilla aria-hidden="true" />
      {children}
    </div>
  )
}

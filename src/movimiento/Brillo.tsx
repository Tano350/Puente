import estilos from './Brillo.module.css'

// El brillo de una tarjeta que se inclina hacia el dedo. Va como último hijo de un elemento con data-carta y
// position: relative; apretar.ts le pasa por variables dónde está el dedo (--brillo-x, --brillo-y) y cuánto se ve.
export function Brillo() {
  return <span className={estilos.brillo} aria-hidden="true" />
}

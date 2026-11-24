import { useEffect, useRef, useState } from 'react'
import { NIVEL, rodado } from './fisica.ts'
import { cadaCuadro, empujon, sinMovimiento } from './resortes.ts'
import { sonar } from './sonido.ts'
import estilos from './Numero.module.css'

// Un número que, cuando cambia, corre hasta su valor nuevo con un salto en cada paso (el saldo al pagar, los cupos
// que quedan, los totales). La primera vez se muestra tal cual. Con "reducir movimiento", cambia al tiro.
export function Numero({ valor, formato = (n) => String(Math.round(n)), className, conSonido = true }: { valor: number; formato?: (n: number) => string; className?: string; conSonido?: boolean }) {
  const [mostrado, setMostrado] = useState(valor)
  const actual = useRef(valor)
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const desde = actual.current
    if (desde === valor) return
    if (sinMovimiento()) {
      actual.current = valor
      setMostrado(valor)
      return
    }
    const inicio = performance.now()
    let texto = formato(desde)
    let ultimoSalto = 0
    let ultimoSonido = 0
    const quitar = cadaCuadro(() => {
      const ahora = performance.now()
      const t = (ahora - inicio) / NIVEL.rodarMs
      const v = t >= 1 ? valor : rodado(desde, valor, t)
      actual.current = v
      setMostrado(v)
      const nuevo = formato(v)
      if (nuevo !== texto) {
        texto = nuevo
        if (ahora - ultimoSalto > 70) {
          ultimoSalto = ahora
          empujon(el.current, { s: 0.5 })
        }
        if (conSonido && ahora - ultimoSonido > 45) {
          ultimoSonido = ahora
          sonar('ficha', Math.min(1, t))
        }
      }
      if (t >= 1) {
        quitar()
        empujon(el.current, { s: 1.5 })
      }
    })
    return quitar
    // El formato puede ser una función nueva en cada render: solo importa el valor
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])
  return (
    <span ref={el} className={className ? `${estilos.numero} ${className}` : estilos.numero}>
      {formato(mostrado)}
    </span>
  )
}

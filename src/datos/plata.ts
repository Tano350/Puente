import { idiomaActual } from './idioma.ts'

// Montos en centavos de dólar, siempre con centavos: "US$ 1.234,56" en español y "US$1,234.56" en inglés.
export function plata(centavos: number): string {
  const ingles = idiomaActual() === 'en'
  const abs = Math.abs(centavos)
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ingles ? ',' : '.')
  const signo = centavos < 0 ? '-' : ''
  const resto = String(abs % 100).padStart(2, '0')
  return ingles ? `${signo}US$${enteros}.${resto}` : `${signo}US$ ${enteros},${resto}`
}

// Lo que alguien escribe como monto, en centavos; null si no es un monto. Sirve igual en los dos idiomas:
// con punto y coma, el último separa los decimales ("1.234,56" y "1,234.56"); con uno solo, una vez y seguido de
// 1 o 2 cifras separa decimales ("84,5", "84.50"), y si no, separa miles ("1.234", "1,234", "1.234.567").
export function aCentavos(texto: string): number | null {
  let t = texto
    .trim()
    .replace(/^US\$/i, '')
    .replace(/\s/g, '')
  if (!t) return null
  const coma = t.lastIndexOf(',')
  const punto = t.lastIndexOf('.')
  if (coma >= 0 && punto >= 0) {
    const decimal = coma > punto ? ',' : '.'
    const miles = decimal === ',' ? '.' : ','
    if (t.indexOf(decimal) !== t.lastIndexOf(decimal)) return null
    t = t.split(miles).join('').replace(decimal, '.')
  } else if (coma >= 0 || punto >= 0) {
    const separador = coma >= 0 ? ',' : '.'
    const partes = t.split(separador)
    if (partes.length === 2 && /^\d{1,2}$/.test(partes[1])) t = partes.join('.')
    else if (partes.slice(1).every((p) => /^\d{3}$/.test(p))) t = partes.join('')
    else return null
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

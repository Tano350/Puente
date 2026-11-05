import { useEffect, useRef } from 'react'
import { Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { cambiarIdioma, useIdioma, type Idioma } from '../../datos/idioma.ts'
import type { CambiosDePersona } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './Idioma.module.css'

// Cada idioma se llama en su propio idioma, en todas las pantallas
const OPCIONES: { idioma: Idioma; nombre: string }[] = [
  { idioma: 'es', nombre: 'Español' },
  { idioma: 'en', nombre: 'English' },
]

export const nombreDelIdioma = (idioma: Idioma) => OPCIONES.find((o) => o.idioma === idioma)!.nombre

// Cambia el idioma en este dispositivo y lo guarda en el perfil. Sin señal el cambio igual se queda en el dispositivo.
// Devuelve el aviso, que ya viene en el idioma elegido.
export function elegirIdioma(idioma: Idioma, actual: Idioma, actualizar: (cambios: CambiosDePersona) => Promise<void>, aviso: Record<Idioma, string>): string | null {
  if (idioma === actual) return null
  cambiarIdioma(idioma)
  void actualizar({ idioma }).catch(() => undefined)
  return aviso[idioma]
}

type Props = { alElegir: (idioma: Idioma) => void; onCerrar: () => void }

// En el celular: una hoja con los dos idiomas
export function HojaIdioma({ abierta, alElegir, onCerrar }: Props & { abierta: boolean }) {
  const { perfil: t } = useTextos()
  const actual = useIdioma()
  return (
    <Hoja abierta={abierta} etiqueta={t.idioma} onCerrar={onCerrar}>
      <TituloHoja>{t.idioma}</TituloHoja>
      <div role="radiogroup" aria-label={t.idioma} className={estilos.lista}>
        {OPCIONES.map(({ idioma, nombre }) => (
          <button key={idioma} type="button" role="radio" aria-checked={actual === idioma} className={estilos.opcion} onClick={() => alElegir(idioma)}>
            {nombre}
            {actual === idioma && (
              <span className={estilos.marca}>
                <Icono nombre="check" medida={22} trazo={2.25} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Hoja>
  )
}

// En el computador: un menú junto a la fila Idioma. Se cierra al tocar fuera o con Escape.
export function MenuIdioma({ alElegir, onCerrar }: Props) {
  const { perfil: t } = useTextos()
  const actual = useIdioma()
  const elegida = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    elegida.current?.focus({ preventScroll: true })
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])
  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden="true" className={estilos.velo} onClick={onCerrar} />
      <div role="menu" aria-label={t.idioma} className={estilos.menu}>
        {OPCIONES.map(({ idioma, nombre }) => (
          <button
            key={idioma}
            ref={actual === idioma ? elegida : undefined}
            type="button"
            role="menuitemradio"
            aria-checked={actual === idioma}
            className={estilos.menuOpcion}
            onClick={() => alElegir(idioma)}
          >
            {nombre}
            {actual === idioma && (
              <span className={estilos.marca}>
                <Icono nombre="check" medida={20} trazo={2.25} />
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

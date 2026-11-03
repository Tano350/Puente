import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { encuadreAlCentro, prepararFoto, type Encuadre } from '../datos/fotos.ts'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import estilos from './EncuadrarFoto.module.css'

// Se acerca hasta 4 veces; los botones y las teclas + y − acercan de a 25 %
const ZOOM_MAXIMO = 4
const PASO_ZOOM = 1.25
// Las flechas mueven la foto un 4 % del cuadrado (con Mayúscula, 16 %)
const PASO_FLECHA = 0.04
const FLECHAS = new Map([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, -1]],
  ['ArrowDown', [0, 1]],
])
// En la barra de tamaño, las flechas acercan de a un paso, igual que los botones
const TECLAS_TAMANO = new Map([
  ['ArrowRight', 1],
  ['ArrowUp', 1],
  ['PageUp', 1],
  ['ArrowLeft', -1],
  ['ArrowDown', -1],
  ['PageDown', -1],
])

// Los puntos van en fracción del cuadrado: 0 es el borde de arriba o de la izquierda y 1 el otro
type Punto = { x: number; y: number }
const CENTRO: Punto = { x: 0.5, y: 0.5 }

const zoomDe = (imagen: ImageBitmap, encuadre: Encuadre) => Math.min(imagen.width, imagen.height) / encuadre.lado
const medio = (a: Punto, b: Punto): Punto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y)

// Con el zoom pedido (entre 1 y 4), lo que estaba en el punto "desde" queda en "hasta".
// Nunca se sale de la foto: el cuadrado queda siempre cubierto.
function encuadrar(imagen: ImageBitmap, actual: Encuadre, zoom: number, desde = CENTRO, hasta = desde): Encuadre {
  const lado = Math.min(imagen.width, imagen.height) / Math.min(Math.max(zoom, 1), ZOOM_MAXIMO)
  const x = actual.x + desde.x * actual.lado - hasta.x * lado
  const y = actual.y + desde.y * actual.lado - hasta.y * lado
  return { x: Math.min(Math.max(x, 0), imagen.width - lado), y: Math.min(Math.max(y, 0), imagen.height - lado), lado }
}

// Tapa todo para mover y acercar la foto elegida dentro del círculo del avatar.
// "Usar foto" entrega el cuadrado que se ve, en un JPEG de 512 px; "Cancelar" o Escape la cierran.
export function EncuadrarFoto({ imagen, onUsar, onCancelar }: { imagen: ImageBitmap; onUsar: (foto: Blob) => void; onCancelar: () => void }) {
  const textos = useTextos()
  const t = textos.perfil.encuadre
  const [encuadre, setEncuadre] = useState(() => encuadreAlCentro(imagen.width, imagen.height))
  const [medida, setMedida] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState(false)
  const visor = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const punteros = useRef(new Map<number, Punto>())
  const preparando = useRef(false)
  const abierta = useRef(true)
  const idAyuda = useId()
  const zoom = zoomDe(imagen, encuadre)

  // Al abrir, el foco entra a la foto; al cerrar, vuelve a lo que estaba antes
  useEffect(() => {
    abierta.current = true
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    visor.current?.focus({ preventScroll: true })
    return () => {
      abierta.current = false
      if (antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const alPresionar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCancelar])

  useLayoutEffect(() => {
    const caja = visor.current
    if (!caja) return
    const medir = () => setMedida(caja.getBoundingClientRect().width)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(caja)
    return () => observador.disconnect()
  }, [])

  // Se dibuja solo el cuadrado visible, con los píxeles de la pantalla para que se vea nítido
  useLayoutEffect(() => {
    const contexto = lienzo.current?.getContext('2d', { alpha: false })
    if (!contexto || !medida || !imagen.width) return
    const lado = Math.round(medida * window.devicePixelRatio)
    if (contexto.canvas.width !== lado) {
      contexto.canvas.width = lado
      contexto.canvas.height = lado
    }
    contexto.imageSmoothingQuality = 'high'
    contexto.fillRect(0, 0, lado, lado)
    contexto.drawImage(imagen, encuadre.x, encuadre.y, encuadre.lado, encuadre.lado, 0, 0, lado, lado)
  }, [imagen, encuadre, medida])

  // La rueda del mouse o el pellizco en el panel táctil acercan hacia el puntero.
  // El dedo que arrastra no desplaza nada: si no, tras un arrastre rápido el navegador se come el toque siguiente.
  useEffect(() => {
    const caja = visor.current
    if (!caja) return
    const alGirar = (e: WheelEvent) => {
      e.preventDefault()
      const borde = caja.getBoundingClientRect()
      const pixeles = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? borde.height : 1
      const factor = Math.exp(-e.deltaY * pixeles * (e.ctrlKey ? 0.01 : 0.002))
      const puntero = { x: (e.clientX - borde.left) / borde.width, y: (e.clientY - borde.top) / borde.height }
      setEncuadre((actual) => encuadrar(imagen, actual, zoomDe(imagen, actual) * factor, puntero))
    }
    const alArrastrar = (e: TouchEvent) => e.preventDefault()
    caja.addEventListener('wheel', alGirar, { passive: false })
    caja.addEventListener('touchmove', alArrastrar, { passive: false })
    return () => {
      caja.removeEventListener('wheel', alGirar)
      caja.removeEventListener('touchmove', alArrastrar)
    }
  }, [imagen])

  const escalonar = (sentido: number) => setEncuadre((actual) => encuadrar(imagen, actual, zoomDe(imagen, actual) * PASO_ZOOM ** sentido))

  // Un dedo (o el mouse) mueve la foto; dos dedos la acercan y la mueven a la vez.
  // Los punteros se guardan en coordenadas de la pantalla.
  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || punteros.current.size >= 2) return
    e.currentTarget.setPointerCapture(e.pointerId)
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setArrastrando(true)
  }
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const antes = punteros.current.get(e.pointerId)
    if (!antes) return
    const ahora = { x: e.clientX, y: e.clientY }
    punteros.current.set(e.pointerId, ahora)
    const otro = [...punteros.current].find(([id]) => id !== e.pointerId)?.[1]
    const factor = otro ? distancia(ahora, otro) / distancia(antes, otro) : 1
    if (!Number.isFinite(factor) || factor <= 0) return
    const borde = e.currentTarget.getBoundingClientRect()
    const enCuadrado = (p: Punto) => ({ x: (p.x - borde.left) / borde.width, y: (p.y - borde.top) / borde.height })
    const desde = enCuadrado(otro ? medio(antes, otro) : antes)
    const hasta = enCuadrado(otro ? medio(ahora, otro) : ahora)
    setEncuadre((actual) => encuadrar(imagen, actual, zoomDe(imagen, actual) * factor, desde, hasta))
  }
  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    punteros.current.delete(e.pointerId)
    if (!punteros.current.size) setArrastrando(false)
  }

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const flecha = FLECHAS.get(e.key)
    const paso = e.shiftKey ? PASO_FLECHA * 4 : PASO_FLECHA
    if (flecha) setEncuadre((actual) => encuadrar(imagen, actual, zoomDe(imagen, actual), CENTRO, { x: 0.5 + flecha[0] * paso, y: 0.5 + flecha[1] * paso }))
    else if (e.key === '+' || e.key === '=') escalonar(1)
    else if (e.key === '-' || e.key === '_') escalonar(-1)
    else return
    e.preventDefault()
  }
  const alTeclearTamano = (e: KeyboardEvent<HTMLInputElement>) => {
    const sentido = TECLAS_TAMANO.get(e.key)
    if (!sentido) return
    e.preventDefault()
    escalonar(sentido)
  }

  // Tab no sale de esta pantalla
  const atrapar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const enfocables = e.currentTarget.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    const activo = document.activeElement
    if (e.shiftKey && (activo === primero || activo === e.currentTarget)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  // Se prepara una sola vez, aunque se toque dos veces
  const usar = async () => {
    if (preparando.current) return
    preparando.current = true
    setOcupado(true)
    setFallo(false)
    try {
      const foto = await prepararFoto(imagen, encuadre)
      if (abierta.current) onUsar(foto)
    } catch {
      preparando.current = false
      if (!abierta.current) return
      setOcupado(false)
      setFallo(true)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.etiqueta} tabIndex={-1} className={estilos.encuadre} onKeyDown={atrapar}>
      <div className={estilos.columna}>
        <div className={estilos.barra}>
          <button type="button" className={estilos.boton} onClick={onCancelar}>
            {textos.cancelar}
          </button>
          <button type="button" className={`${estilos.boton} ${estilos.usar}`} aria-disabled={ocupado} onClick={() => void usar()}>
            {t.usar}
          </button>
        </div>
        <div className={estilos.centro}>
          <div className={estilos.grupo}>
            <div
              ref={visor}
              role="img"
              aria-label={t.foto}
              aria-describedby={idAyuda}
              tabIndex={0}
              className={estilos.visor}
              data-arrastrando={arrastrando}
              onPointerDown={alBajar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              onLostPointerCapture={alSoltar}
              onKeyDown={alTeclear}
            >
              <canvas ref={lienzo} className={estilos.lienzo} />
              <div className={estilos.circulo} />
            </div>
            {fallo ? (
              <p key="fallo" id={idAyuda} role="alert" className={estilos.error}>
                {t.noSePudo}
              </p>
            ) : (
              <p key="ayuda" id={idAyuda} className={estilos.ayuda}>
                {t.ayuda}
              </p>
            )}
            <div className={estilos.zoom}>
              <button type="button" className={estilos.icono} aria-label={t.alejar} aria-disabled={zoom <= 1.001} onClick={() => escalonar(-1)}>
                <Icono nombre="alejar" />
              </button>
              <input
                type="range"
                className={estilos.tamano}
                aria-label={t.tamano}
                aria-valuetext={t.porcentaje(Math.round(zoom * 100))}
                min={1}
                max={ZOOM_MAXIMO}
                step={0.01}
                value={Math.round(zoom * 100) / 100}
                onChange={(e) => {
                  const valor = Number(e.target.value)
                  setEncuadre((actual) => encuadrar(imagen, actual, valor))
                }}
                onKeyDown={alTeclearTamano}
              />
              <button type="button" className={estilos.icono} aria-label={t.acercar} aria-disabled={zoom >= ZOOM_MAXIMO - 0.001} onClick={() => escalonar(1)}>
                <Icono nombre="acercar" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

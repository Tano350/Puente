import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { Brillo, chispasDesde, cuerpo, empujon, ladeo, NIVEL, Numero, seguir, sonar, vibrar } from '../../movimiento/index.ts'
import estilos from './EventoBoleto.module.css'

const ALTO = 168
const TALON = 96

// Lo que dice el talón: tu estado ("Quedan 4 cupos", "3.º en espera"…)
export type Talon = { arriba: string; abajo: string; grande?: string; marca?: 'check' | 'candado' }

// El papel del boleto: esquinas redondas y una muesca arriba y abajo, donde va el corte del talón
function forma(ancho: number, alto: number): string {
  const corte = ancho - TALON
  const abajo = alto - 0.5
  return [
    `M10.5 0.5 H${corte - 10} A10 10 0 0 0 ${corte + 10} 0.5 H${ancho - 10.5} A10 10 0 0 1 ${ancho - 0.5} 10.5`,
    `V${alto - 10.5} A10 10 0 0 1 ${ancho - 10.5} ${abajo} H${corte + 10} A10 10 0 0 0 ${corte - 10} ${abajo}`,
    `H10.5 A10 10 0 0 1 0.5 ${alto - 10.5} V10.5 A10 10 0 0 1 10.5 0.5 Z`,
  ].join(' ')
}

// El evento como boleto: tipo, nombre, día y hora a la izquierda; tu estado en el talón
export function EventoBoleto({ tipo, titulo, fecha, horario, chile, talon, encabezado }: { tipo: string; titulo: string; fecha: string; horario: string; chile: string | null; talon: Talon | null; encabezado: 'h1' | 'h2' }) {
  const caja = useRef<HTMLDivElement>(null)
  const datos = useRef<HTMLDivElement>(null)
  const sello = useRef<HTMLSpanElement>(null)
  // El check cae como un sello cuando tomas el lugar (no al abrir el boleto ni al soltarlo)
  const marcaAntes = useRef<string | null | undefined>(undefined)
  const marca = talon ? (talon.marca ?? '') : null
  useEffect(() => {
    const antes = marcaAntes.current
    marcaAntes.current = marca
    const check = sello.current
    if (marca !== 'check' || antes === undefined || antes === null || antes === 'check' || !check) return
    const c = cuerpo(check)
    c.k = 700
    c.c = 26
    c.pos({ s: 2.4, r: -22 }).meta({ s: 1, r: 0 })
    c.alQuieto = () => {
      c.k = null
      c.c = null
      empujon(caja.current, { s: 0.5 })
      chispasDesde(check)
      sonar('timbre')
      vibrar(18)
    }
  }, [marca])
  // El boleto se agarra y se lanza: sigue al dedo con un poco de atraso, se ladea con la velocidad y vuelve a su lugar
  const agarrar = (e: React.PointerEvent) => {
    const el = caja.current
    if (!el) return
    const c = cuerpo(el)
    seguir(e, {
      eje: 'libre',
      mantener: NIVEL.mantener,
      alEmpezar: () => {
        sonar('levantar')
      },
      alMover: (p) => c.meta({ x: p.dx, y: p.dy, r: ladeo(p.vx, NIVEL.ladeo), s: NIVEL.levantar }),
      alSoltar: (p) => {
        c.vel({ r: ladeo(p.vx, NIVEL.ladeo) * 0.8 })
        c.meta({ x: 0, y: 0, r: 0, s: 1 })
        sonar('soltar')
      },
    })
  }
  const [medida, setMedida] = useState({ ancho: 358, alto: ALTO })
  // El dibujo sigue el ancho de la columna (un celular angosto, la columna del computador) y,
  // si la hora de Chile no cabe en una línea, crece hacia abajo
  useLayoutEffect(() => {
    const elemento = caja.current
    const contenido = datos.current
    if (!elemento || !contenido) return
    const medir = () => {
      const ancho = elemento.offsetWidth
      const alto = Math.max(ALTO, contenido.offsetHeight + 16)
      setMedida((antes) => (antes.ancho === ancho && antes.alto === alto ? antes : { ancho, alto }))
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    observador.observe(contenido)
    return () => observador.disconnect()
  }, [])
  const { ancho, alto } = medida
  const Titulo = encabezado
  const corte = ancho - TALON
  return (
    <div ref={caja} className={estilos.boleto} style={{ height: alto }} data-carta data-arrastrable onPointerDown={agarrar}>
      <svg aria-hidden="true" className={estilos.dibujo} width={ancho} height={alto}>
        <path className={estilos.papel} d={forma(ancho, alto)} />
        <path className={estilos.picado} d={`M${corte} 16 V${alto - 16}`} />
      </svg>
      <div ref={datos} className={estilos.datos}>
        <div className={estilos.tipo}>{tipo}</div>
        <Titulo className={estilos.titulo}>{titulo}</Titulo>
        <div className={estilos.fecha}>{fecha}</div>
        <div className={estilos.horario}>{horario}</div>
        {chile && <div className={estilos.chile}>{chile}</div>}
      </div>
      {talon && (
        <div className={estilos.talon}>
          {talon.arriba && <span className={estilos.arriba}>{talon.arriba}</span>}
          {talon.grande && <span className={estilos.grande}>{/^\d{1,3}$/.test(talon.grande) ? <Numero valor={Number(talon.grande)} /> : talon.grande}</span>}
          {talon.marca === 'check' && (
            <span ref={sello} className={estilos.check}>
              <Icono nombre="check" medida={40} trazo={2.5} />
            </span>
          )}
          {talon.marca === 'candado' && (
            <span className={estilos.candado}>
              <Icono nombre="candado" medida={34} trazo={2} />
            </span>
          )}
          {talon.abajo && <span className={estilos.abajo}>{talon.abajo}</span>}
        </div>
      )}
      <Brillo />
    </div>
  )
}

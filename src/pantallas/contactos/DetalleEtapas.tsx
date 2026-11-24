import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { ETAPAS, type Etapa } from '../../datos/contactos.ts'
import { conMayuscula, diaCorto, diaLocal, hoyAqui } from '../../datos/fechas.ts'
import { cadaCuadro, cuerpo, giroAlRodar, masCercana, sacudir, seguir, sonar } from '../../movimiento/index.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleEtapas.module.css'

type Props = {
  etapa: Etapa
  etapaEn: string
  activa: boolean
  apagada?: boolean
  // Puede devolver una promesa: mientras se guarda, la tuerca espera en la etapa nueva
  onElegir: (etapa: Etapa) => unknown
  // Se tocó o se quiso arrastrar sin poder: el aviso dice por qué
  onNoPuede: () => void
}

// Las cinco etapas como tuercas en línea: las hechas en tinta, la actual en acento (con su fecha) y las que faltan huecas.
// Descartado no está en la línea: todas quedan huecas. Tocar una tuerca cambia la etapa, si se puede cambiar el contacto;
// la actual también se puede llevar rodando por la línea hasta otra etapa. Si no se puede, la línea tiembla y un aviso
// dice por qué.
export function DetalleEtapas({ etapa, etapaEn, activa, apagada = false, onElegir, onNoPuede }: Props) {
  const textos = useTextos()
  const t = textos.contactos
  const grupo = useRef<HTMLDivElement>(null)
  const avance = useRef<HTMLDivElement>(null)
  // La tuerca que se llevó rodando y cómo dejar de mover el avance con ella: vuelve a su lugar cuando cambia la etapa
  const rodada = useRef<HTMLElement | null>(null)
  const parar = useRef(() => {})
  const [cerca, setCerca] = useState<number | null>(null)
  const actual = ETAPAS.findIndex((e) => e === etapa)
  const puede = activa && !apagada
  const dia = diaLocal(etapaEn)
  const fecha = dia === hoyAqui() ? conMayuscula(t.detalle.hoy) : diaCorto(dia)

  useLayoutEffect(() => {
    if (!rodada.current) return
    parar.current()
    const c = cuerpo(rodada.current)
    c.alQuieto = null
    c.fijar({ x: 0, r: 0 })
    rodada.current = null
    if (avance.current) avance.current.style.width = `${Math.max(actual, 0) * 20}%`
  }, [etapa, actual])

  const noPuede = () => {
    sacudir(grupo.current)
    sonar('error')
    onNoPuede()
  }

  // Llevar la tuerca actual por la línea: rueda, el avance la sigue y se marca la etapa más cercana
  const rodar = (e: PointerEvent<HTMLButtonElement>) => {
    const tuerca = e.currentTarget.querySelector<HTMLElement>('[data-tuerca]')
    const raiz = grupo.current
    const linea = avance.current
    if (!tuerca || !raiz || !linea) return
    const desde = actual
    let centros: number[] = []
    let izquierda = 0
    let dx = 0
    let elegida = desde
    const c = cuerpo(tuerca)
    const seguirAvance = () => {
      linea.style.width = `${Math.max(0, centros[desde] + c.p.x - izquierda).toFixed(1)}px`
    }
    const volver = () => {
      parar.current = cadaCuadro(seguirAvance)
      c.meta({ x: 0, r: 0 })
      c.alQuieto = () => {
        parar.current()
        linea.style.width = `${desde * 20}%`
        if (rodada.current === tuerca) rodada.current = null
      }
    }
    seguir(e, {
      eje: 'x',
      alEmpezar: () => {
        if (!puede) {
          noPuede()
          return false
        }
        const caja = raiz.getBoundingClientRect()
        centros = [...raiz.querySelectorAll<HTMLElement>('[data-estacion]')].map((b) => {
          const r = b.getBoundingClientRect()
          return r.left + r.width / 2
        })
        izquierda = caja.left + caja.width * 0.1
        rodada.current = tuerca
        c.k = 1100
        c.c = 55
        c.alQuieto = null
        parar.current = cadaCuadro(seguirAvance)
      },
      alMover: (p) => {
        dx = Math.max(centros[0] - centros[desde], Math.min(centros[centros.length - 1] - centros[desde], p.dx))
        c.meta({ x: dx, r: giroAlRodar(dx, tuerca.offsetWidth) })
        const i = masCercana(centros[desde] + dx, centros)
        if (i !== elegida) {
          elegida = i
          sonar('tick')
        }
        setCerca(i)
      },
      alSoltar: (_p, cancelado) => {
        const i = cancelado ? desde : masCercana(centros[desde] + dx, centros)
        const meta = centros[i] - centros[desde]
        c.k = null
        c.c = null
        setCerca(null)
        c.meta({ x: meta, r: giroAlRodar(meta, tuerca.offsetWidth) })
        c.alQuieto = () => {
          parar.current()
          if (i === desde) {
            linea.style.width = `${desde * 20}%`
            rodada.current = null
            return
          }
          sonar('soltar')
          // Si no cambió (sin guardar, o fue a Crear evento y volvió), la tuerca vuelve rodando
          // (se espera un poco: la etapa nueva llega en el render que sigue a guardar)
          void Promise.resolve(onElegir(ETAPAS[i])).finally(() =>
            window.setTimeout(() => {
              if (rodada.current === tuerca) volver()
            }, 150),
          )
        }
      },
    })
  }

  return (
    <div ref={grupo} role="group" aria-label={t.detalle.estado} className={estilos.etapas} data-activa={activa}>
      <div aria-hidden="true" className={estilos.riel} />
      <div ref={avance} aria-hidden="true" className={estilos.avance} style={{ width: `${Math.max(actual, 0) * 20}%` }} />
      {ETAPAS.map((e, i) => {
        const paso = i === actual ? 'actual' : i < actual ? 'hecha' : 'falta'
        return (
          <button
            key={e}
            type="button"
            className={estilos.estacion}
            data-estacion=""
            data-paso={paso}
            data-cerca={cerca === i}
            data-arrastrable={paso === 'actual' ? '' : undefined}
            aria-current={paso === 'actual' ? 'step' : undefined}
            aria-disabled={!puede || undefined}
            onPointerDown={paso === 'actual' ? rodar : undefined}
            onClick={() => (puede ? onElegir(e) : noPuede())}
          >
            <span className={estilos.tuerca} data-tuerca="">
              <span className={paso === 'falta' ? estilos.hueco : estilos.agujero} />
            </span>
            <span className={estilos.nombre}>{t.etapas[e]}</span>
            {paso === 'actual' && <span className={estilos.fecha}>{fecha}</span>}
          </button>
        )
      })}
    </div>
  )
}

import { useRef, type PointerEvent } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { ETAPAS, seAgenda, type Contacto, type Etapa } from '../../datos/contactos.ts'
import { useFlip } from '../../movimiento/index.ts'
import { useTextos } from '../../textos.ts'
import { festejar, useArrastre } from './arrastre.ts'
import { Hueco } from './Hueco.tsx'
import type { Responsable } from './ListaPorEtapa.tsx'
import estilos from './TableroContactos.module.css'

const COLUMNAS: Etapa[] = [...ETAPAS, 'descartado']

type Props = {
  contactos: Contacto[]
  mios: boolean
  elegido?: string
  responsable: (contacto: Contacto) => Responsable
  puedeMover: (contacto: Contacto) => boolean
  onAbrir: (contacto: Contacto) => void
  onMover: (contacto: Contacto, etapa: Etapa) => void
  onNoPuede: (contacto: Contacto) => void
}

// Computador: una columna por estado, unidas por la línea de tuercas; "Descartado" va aparte.
// Quien puede cambiar un contacto lo arrastra a otra columna (arrastre.ts: con el mouse basta moverlo; en una pantalla
// táctil, mantenerlo apretado). Soltar en "Reunión agendada" desde antes abre Crear evento, como "Agendar reunión" en el detalle.
export function TableroContactos({ contactos, mios, elegido, responsable, puedeMover, onAbrir, onMover, onNoPuede }: Props) {
  const tablero = useRef<HTMLDivElement>(null)
  const arrastre = useArrastre<Contacto>({
    contenedor: tablero,
    zonas: 'punto',
    flip: false,
    clave: (c) => c.id,
    zonaDe: (c) => c.etapa,
    puede: puedeMover,
    alNoPoder: onNoPuede,
    alSoltar: (c, zona, el) => {
      const etapa = zona as Etapa
      onMover(c, etapa)
      if (!seAgenda(c.etapa, etapa)) festejar(el, { conChispas: etapa !== 'descartado' })
    },
    claseFantasma: estilos.fantasma,
    desplazable: (zona) => zona?.querySelector<HTMLElement>('[data-desplazable]'),
  })

  return (
    <div ref={tablero} className={estilos.tablero}>
      {COLUMNAS.map((etapa) => (
        <Columna
          key={etapa}
          etapa={etapa}
          lista={contactos.filter((c) => c.etapa === etapa)}
          mios={mios}
          elegido={elegido}
          responsable={responsable}
          arrastrado={arrastre.arrastrado}
          sobre={arrastre.sobre === etapa}
          alto={arrastre.alto}
          onAbrir={onAbrir}
          onEmpezar={arrastre.empezar}
        />
      ))}
    </div>
  )
}

type PropsColumna = {
  etapa: Etapa
  lista: Contacto[]
  mios: boolean
  elegido?: string
  responsable: (contacto: Contacto) => Responsable
  arrastrado: Contacto | null
  sobre: boolean
  alto: number
  onAbrir: (contacto: Contacto) => void
  onEmpezar: (e: PointerEvent<HTMLElement>, contacto: Contacto) => void
}

// Una columna: sus tarjetas se reacomodan con useFlip (medidas dentro de la columna, que se desplaza sola)
function Columna({ etapa, lista, mios, elegido, responsable, arrastrado, sobre, alto, onAbrir, onEmpezar }: PropsColumna) {
  const textos = useTextos()
  const t = textos.contactos
  const pila = useRef<HTMLDivElement>(null)
  useFlip(pila, { nuevos: false })
  const descartado = etapa === 'descartado'
  const recibe = arrastrado !== null && arrastrado.etapa !== etapa
  return (
    <section className={estilos.columna} data-descartado={descartado} data-zona={etapa} data-sobre={sobre}>
      <div className={estilos.riel} aria-hidden="true">
        {!descartado && etapa !== 'reunion_hecha' && <span className={estilos.tramo} />}
        <span className={estilos.tuerca} data-tuerca="" />
      </div>
      <h2 className={estilos.titulo}>
        <span className={estilos.etapa}>{t.etapas[etapa]}</span>
        <span className={estilos.cuenta} data-cuenta="">
          {lista.length}
        </span>
      </h2>
      <div className={estilos.tarjetas} data-soltar={sobre} data-desplazable="">
        <div ref={pila} className={estilos.pila}>
          {lista.map((c) => {
            const r = responsable(c)
            return (
              <button
                key={c.id}
                type="button"
                className={estilos.tarjeta}
                aria-pressed={elegido === c.id}
                data-flip={c.id}
                data-arrastrable=""
                data-arrastrado={arrastrado?.id === c.id}
                onPointerDown={(e) => onEmpezar(e, c)}
                onClick={() => onAbrir(c)}
              >
                <span className={estilos.nombreFila}>
                  <span className={estilos.nombre}>{c.nombre}</span>
                  {c.personal && (
                    <span className={estilos.candado} role="img" aria-label={t.personal}>
                      <Icono nombre="candado" medida={13} trazo={2} />
                    </span>
                  )}
                </span>
                {c.organizacion && <span className={estilos.org}>{c.organizacion}</span>}
                {!mios && (
                  <span className={estilos.responsable} data-tu={r.tuyo}>
                    {r.texto}
                  </span>
                )}
              </button>
            )
          })}
          {recibe && <Hueco abierto={sobre} alto={alto} className={estilos.hueco} />}
        </div>
      </div>
    </section>
  )
}

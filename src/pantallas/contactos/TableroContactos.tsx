import { useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { ETAPAS, type Contacto, type Etapa } from '../../datos/contactos.ts'
import { useTextos } from '../../textos.ts'
import type { Responsable } from './ListaPorEtapa.tsx'
import estilos from './TableroContactos.module.css'

const COLUMNAS: Etapa[] = [...ETAPAS, 'descartado']

// Igual que en el detalle: por ahora "Reunión agendada" se marca directo.
// Cuando exista la Agenda, soltar ahí abrirá "Crear evento", como "Agendar reunión".
function puedeSoltar(contacto: Contacto, etapa: Etapa): boolean {
  return etapa !== contacto.etapa
}

type Props = {
  contactos: Contacto[]
  mios: boolean
  elegido?: string
  responsable: (contacto: Contacto) => Responsable
  puedeMover: (contacto: Contacto) => boolean
  onAbrir: (contacto: Contacto) => void
  onMover: (contacto: Contacto, etapa: Etapa) => void
}

// Computador: una columna por estado, unidas por la línea de tuercas; "Descartado" va aparte.
// Quien puede cambiar un contacto lo arrastra a otra columna.
export function TableroContactos({ contactos, mios, elegido, responsable, puedeMover, onAbrir, onMover }: Props) {
  const textos = useTextos()
  const t = textos.contactos
  const [arrastrado, setArrastrado] = useState<Contacto | null>(null)
  const [sobre, setSobre] = useState<Etapa | null>(null)
  const terminar = () => {
    setArrastrado(null)
    setSobre(null)
  }

  return (
    <div className={estilos.tablero}>
      {COLUMNAS.map((etapa) => {
        const lista = contactos.filter((c) => c.etapa === etapa)
        const acepta = arrastrado !== null && puedeSoltar(arrastrado, etapa)
        const descartado = etapa === 'descartado'
        return (
          <section
            key={etapa}
            className={estilos.columna}
            data-descartado={descartado}
            onDragOver={(e) => {
              if (!acepta) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setSobre(etapa)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre((antes) => (antes === etapa ? null : antes))
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (arrastrado && acepta) onMover(arrastrado, etapa)
              terminar()
            }}
          >
            <div className={estilos.riel} aria-hidden="true">
              {!descartado && etapa !== 'reunion_hecha' && <span className={estilos.tramo} />}
              <span className={estilos.tuerca} />
            </div>
            <h2 className={estilos.titulo}>
              <span className={estilos.etapa}>{t.etapas[etapa]}</span>
              <span className={estilos.cuenta}>{lista.length}</span>
            </h2>
            <div className={estilos.tarjetas} data-soltar={sobre === etapa}>
              {lista.map((c) => {
                const r = responsable(c)
                const movible = puedeMover(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={estilos.tarjeta}
                    aria-pressed={elegido === c.id}
                    draggable={movible}
                    data-arrastrado={arrastrado?.id === c.id}
                    onClick={() => onAbrir(c)}
                    onDragStart={(e) => {
                      if (!movible) return
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', c.id)
                      setArrastrado(c)
                    }}
                    onDragEnd={terminar}
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
            </div>
          </section>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { ETAPAS, type Contacto } from '../../datos/contactos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './ListaPorEtapa.module.css'

export type Responsable = { texto: string; tuyo: boolean }

type Props = { contactos: Contacto[]; mios: boolean; responsable: (contacto: Contacto) => Responsable; onAbrir: (contacto: Contacto) => void }

// Celular: los contactos por estado, colgando de la línea de tuercas; los descartados van al final, plegados
export function ListaPorEtapa({ contactos, mios, responsable, onAbrir }: Props) {
  const textos = useTextos()
  const t = textos.contactos
  const [verDescartados, setVerDescartados] = useState(false)
  const grupos = ETAPAS.map((etapa) => ({ etapa, lista: contactos.filter((c) => c.etapa === etapa) })).filter((g) => g.lista.length > 0)
  const descartados = contactos.filter((c) => c.etapa === 'descartado')
  // Si solo quedan descartados, se ven sin tener que abrirlos
  const abiertos = grupos.length === 0 || verDescartados

  const nombre = (c: Contacto) => (
    <span className={estilos.nombreFila}>
      <span className={estilos.nombre}>{c.nombre}</span>
      {c.personal && (
        <span className={estilos.candado} role="img" aria-label={t.personal}>
          <Icono nombre="candado" medida={14} trazo={2} />
        </span>
      )}
    </span>
  )

  return (
    <div className={estilos.lista}>
      {grupos.map((g, i) => {
        const primera = i === 0
        const ultima = i === grupos.length - 1
        return (
          <section key={g.etapa}>
            <div className={estilos.cabeza} data-primera={primera}>
              <span className={estilos.riel} aria-hidden="true">
                {!(primera && ultima) && <span className={estilos.tramo} data-desde={primera ? 'tuerca' : undefined} data-hasta={ultima ? 'tuerca' : undefined} />}
                <span className={estilos.tuerca} />
              </span>
              <h2 className={estilos.etapa}>
                {t.etapas[g.etapa]}
                <span className={estilos.cuenta}>{g.lista.length}</span>
              </h2>
            </div>
            {g.lista.map((c) => {
              const r = responsable(c)
              return (
                <button key={c.id} type="button" className={estilos.fila} onClick={() => onAbrir(c)}>
                  <span className={estilos.riel} aria-hidden="true">
                    {!ultima && <span className={estilos.tramo} />}
                  </span>
                  <span className={estilos.contenido}>
                    <span className={estilos.quien}>
                      {nombre(c)}
                      {c.organizacion && <span className={estilos.org}>{c.organizacion}</span>}
                    </span>
                    {!mios && (
                      <span className={estilos.responsable} data-tu={r.tuyo}>
                        {r.texto}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}
      {descartados.length > 0 && (
        <div className={estilos.descartados}>
          <button type="button" className={estilos.plegar} aria-expanded={abiertos} onClick={() => setVerDescartados(!abiertos)}>
            <span className={estilos.flecha} data-abierta={abiertos}>
              <Icono nombre="derecha" medida={18} trazo={2} />
            </span>
            <span className={estilos.descartadosTitulo}>{t.lista.descartados}</span>
            <span className={estilos.descartadosCuenta}>{descartados.length}</span>
          </button>
          {abiertos &&
            descartados.map((c) => (
              <button key={c.id} type="button" className={estilos.descartado} onClick={() => onAbrir(c)}>
                <span className={estilos.quien}>
                  {nombre(c)}
                  {c.organizacion && <span className={estilos.org}>{c.organizacion}</span>}
                </span>
                {!mios && <span className={estilos.responsable}>{responsable(c).texto}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

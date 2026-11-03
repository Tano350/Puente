import { ETAPAS, type Etapa } from '../../datos/contactos.ts'
import { conMayuscula, diaCorto, diaLocal, hoyAqui } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import estilos from './DetalleEtapas.module.css'


// Las cinco etapas como tuercas en línea: las hechas en tinta, la actual en acento (con su fecha) y las que faltan huecas.
// Descartado no está en la línea: todas quedan huecas. Tocar una tuerca cambia la etapa, si se puede cambiar el contacto.
export function DetalleEtapas({ etapa, etapaEn, activa, onElegir }: { etapa: Etapa; etapaEn: string; activa: boolean; onElegir: (etapa: Etapa) => void }) {
  const textos = useTextos()
  const t = textos.contactos
  const actual = ETAPAS.findIndex((e) => e === etapa)
  const dia = diaLocal(etapaEn)
  const fecha = dia === hoyAqui() ? conMayuscula(t.detalle.hoy) : diaCorto(dia)
  return (
    <div role="group" aria-label={t.detalle.estado} className={estilos.etapas} data-activa={activa}>
      <div aria-hidden="true" className={estilos.riel} />
      <div aria-hidden="true" className={estilos.avance} style={{ width: `${Math.max(actual, 0) * 20}%` }} />
      {ETAPAS.map((e, i) => {
        const paso = i === actual ? 'actual' : i < actual ? 'hecha' : 'falta'
        return (
          <button key={e} type="button" className={estilos.estacion} data-paso={paso} aria-current={paso === 'actual' ? 'step' : undefined} disabled={!activa} onClick={() => onElegir(e)}>
            <span className={estilos.tuerca}>
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

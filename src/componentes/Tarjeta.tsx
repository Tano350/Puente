import { useNavigate } from 'react-router'
import type { Persona } from '../datos/consultas.ts'
import { useContactos } from '../datos/contactos.ts'
import { diaLargo, diasEntre, estadia, hoyEnCalifornia, indiceEnElViaje, mesesDe, rango, rangoLargo, ventanaDelViaje } from '../datos/fechas.ts'
import { tieneFechas, useViaje, type ConFechas } from '../datos/grupo.ts'
import { carreraCorta, primerNombre } from '../datos/nombres.ts'
import { useTextos } from '../textos.ts'
import { Avatar } from './Avatar.tsx'
import { Icono } from './Icono.tsx'
import estilos from './Tarjeta.module.css'

function enlaceLinkedin(linkedin: string): string {
  return /^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`
}

// La tarjeta de presentación de una persona: así se ve cada uno en Puente
export function Tarjeta({ persona }: { persona: Persona }) {
  const textos = useTextos()
  const estado = estadia(persona.llega, persona.vuelve)
  return (
    <div className={estilos.tarjeta}>
      {persona.carrera && <span className={estilos.cinta}>{carreraCorta(persona.carrera)}</span>}
      <div className={estilos.cabeza}>
        <Avatar persona={persona} medida={56} />
        <span className={estilos.quien}>
          <span className={estilos.nombre}>{persona.nombre ?? persona.correo}</span>
          {estado.tipo !== 'sinFechas' && (
            <span className={estilos.estado} data-alla={estado.tipo === 'alla'}>
              {estado.tipo === 'alla' && <span className={estilos.punto} aria-hidden="true" />}
              {estado.texto}
            </span>
          )}
        </span>
      </div>
      {persona.linkedin && (
        <div className={estilos.linkedin}>
          <span className={estilos.linkedinIcono}>
            <Icono nombre="linkedin" medida={20} />
          </span>
          <span className={estilos.linkedinTexto}>
            <span className={estilos.linkedinEtiqueta}>LinkedIn</span>
            <span>{textos.perfilDe(primerNombre(persona))}</span>
          </span>
          <a className={estilos.abrir} href={enlaceLinkedin(persona.linkedin)} target="_blank" rel="noreferrer">
            {textos.abrir}
          </a>
        </div>
      )}
    </div>
  )
}

// Las dos estadías, una sobre otra, con la raya de hoy
function EstadiaComparada({ persona, yo, hoy }: { persona: ConFechas; yo: ConFechas; hoy: string }) {
  const textos = useTextos()
  // La del grupo, y si alguna de las dos estadías se sale de ella, se estira
  const grupo = useViaje()
  const viaje = ventanaDelViaje([{ llega: grupo.desde, vuelve: grupo.hasta }, persona, yo])
  const porcentaje = (dias: number) => `${(dias / viaje.dias) * 100}%`
  const hoyEnLaLinea = indiceEnElViaje(hoy, viaje)
  const fila = (quien: ConFechas, tu: boolean) => {
    const a = Math.max(indiceEnElViaje(quien.llega, viaje), 0)
    const b = Math.min(indiceEnElViaje(quien.vuelve, viaje), viaje.dias - 1)
    return (
      <div className={estilos.compFila}>
        <span className={estilos.compNombre} data-tu={tu}>{tu ? textos.grupo.tu : primerNombre(quien)}</span>
        <span className={estilos.compPista}>
          <span className={estilos.compTramo} data-tu={tu} style={{ left: porcentaje(a), width: porcentaje(b - a + 1) }} />
        </span>
      </div>
    )
  }
  return (
    <div className={estilos.comparada}>
      <div className={estilos.compMeses}>
        {mesesDe(viaje).map((mes) => (
          <span key={mes.nombre} style={{ flex: mes.dias }}>{mes.dias < 7 ? '' : mes.dias < 20 ? mes.nombre.slice(0, 3) : mes.nombre}</span>
        ))}
      </div>
      <div className={estilos.compCuerpo}>
        {hoyEnLaLinea >= 0 && hoyEnLaLinea < viaje.dias && (
          <div className={estilos.compHoy} aria-hidden="true" style={{ left: `calc(var(--etiqueta) + (100% - var(--etiqueta)) * ${(hoyEnLaLinea + 0.5) / viaje.dias})` }} />
        )}
        {fila(persona, false)}
        {fila(yo, true)}
      </div>
    </div>
  )
}

// Lo que acompaña a la tarjeta: emprendimiento, objetivos y estadía.
// Si mira otra persona (yo), la estadía se compara con la suya.
export function DetallePersona({ persona, yo }: { persona: Persona; yo?: Persona }) {
  const textos = useTextos()
  const navigate = useNavigate()
  const { data: contactos } = useContactos()
  const t = textos.persona
  const otra = yo && yo.id !== persona.id ? yo : null
  const hoy = hoyEnCalifornia()
  // Así se coordina sin preguntar: qué contactos lleva cada uno y en qué van
  const aCargo = (contactos ?? []).filter((c) => c.responsable === persona.id)

  const comparacion = (p: ConFechas, mia: ConFechas) => {
    const estado = hoy < p.llega ? t.llegaEl(diaLargo(p.llega)) : hoy > p.vuelve ? t.volvioEl(diaLargo(p.vuelve)) : t.allaAhora
    const desde = p.llega > mia.llega ? p.llega : mia.llega
    const hasta = p.vuelve < mia.vuelve ? p.vuelve : mia.vuelve
    const juntos = desde > hasta ? t.noCoinciden : hasta < hoy ? t.coincidieron(rango(desde, hasta)) : t.coinciden(rango(desde, hasta))
    return `${estado} ${juntos}`
  }

  return (
    <>
      {persona.emprendimiento && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>{t.emprendimiento}</div>
          <div className={estilos.emprendimiento}>
            <div className={estilos.empNombre}>{persona.emprendimiento}</div>
            {persona.emprendimiento_texto && <div>{persona.emprendimiento_texto}</div>}
          </div>
        </div>
      )}
      {persona.objetivos && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>{t.objetivos}</div>
          <div className={estilos.objetivos}>{persona.objetivos}</div>
        </div>
      )}
      {otra && !persona.emprendimiento && !persona.objetivos && <div className={estilos.incompleto}>{t.incompleto(primerNombre(persona))}</div>}
      {tieneFechas(persona) && (
        <div className={estilos.bloque}>
          <div className={estilos.rotulo}>{t.estadia}</div>
          <div className={estilos.rango}>{rangoLargo(persona.llega, persona.vuelve)}</div>
          <div className={estilos.dias}>{otra && tieneFechas(otra) ? comparacion(persona, otra) : textos.fechas.dias(diasEntre(persona.llega, persona.vuelve))}</div>
          {otra && tieneFechas(otra) && <EstadiaComparada persona={persona} yo={otra} hoy={hoy} />}
        </div>
      )}
      {aCargo.length > 0 && (
        <div className={estilos.bloque}>
          <div className={estilos.cargoTitulo}>
            <span>{t.aSuCargo}</span>
            <span>{aCargo.length}</span>
          </div>
          <div className={estilos.cargo}>
            {aCargo.map((c) => (
              <button key={c.id} type="button" className={estilos.cargoFila} onClick={() => navigate(`/contactos/${c.id}`)}>
                <span className={estilos.cargoQuien}>
                  <span className={estilos.cargoNombre}>{c.nombre}</span>
                  {c.organizacion && <span className={estilos.cargoOrg}>{c.organizacion}</span>}
                </span>
                <span className={estilos.cargoEtapa}>{textos.contactos.etapas[c.etapa]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

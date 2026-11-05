import { useNavigate } from 'react-router'
import { Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono, type NombreIcono } from '../../componentes/Icono.tsx'
import type { Contacto } from '../../datos/contactos.ts'
import type { Evento } from '../../datos/eventos.ts'
import { conMayuscula, diaEn, diaLargo, hora } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { dondeCorto } from './HoyDatos.ts'
import estilosHoy from './Hoy.module.css'
import estilos from './HoyVolver.module.css'

// Lo que queda para cerrar el viaje: las notas de reunión que faltan, transferir lo que debes y elegir qué gastos rindes.
// En el computador, cada uno muestra su detalle al lado.
export type Cierre = { id: 'notas' | 'pago' | 'rendir'; icono: NombreIcono; texto: string }

// En el celular, filas como las de pendientes; en el computador, tarjetas que se eligen
export function ParaCerrar({ cierres, computador, elegido, onElegir }: { cierres: Cierre[]; computador: boolean; elegido: Cierre['id']; onElegir: (id: Cierre['id']) => void }) {
  const navigate = useNavigate()
  // Lo que se hace en Gastos va directo ahí, sin un paso de más: en el celular, "Saldar" ya abierto; en el computador, la lista de la rendición
  const elegir = (id: Cierre['id']) => {
    if (id === 'pago' && !computador) navigate('/gastos', { state: { ver: 'saldos', saldar: true } })
    else if (id === 'rendir' && computador) navigate('/gastos', { state: { ver: 'rendicion' } })
    else onElegir(id)
  }
  if (computador) {
    return (
      <div className={estilos.tarjetas}>
        {cierres.map((c) => (
          <button key={c.id} type="button" className={estilos.tarjeta} aria-pressed={elegido === c.id} onClick={() => elegir(c.id)}>
            <Icono nombre={c.icono} medida={20} />
            <span className={estilos.tarjetaTexto}>{c.texto}</span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <ul className={estilosHoy.lista}>
      {cierres.map((c) => (
        <li key={c.id}>
          <button type="button" className={estilosHoy.pendiente} onClick={() => elegir(c.id)}>
            <Icono nombre={c.icono} medida={20} />
            <span className={estilosHoy.pendienteTexto}>{c.texto}</span>
            <Icono nombre="derecha" medida={16} trazo={2} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function conQuien(evento: Evento, contactos: Contacto[], con: (nombre: string, organizacion: string | null) => string): string {
  const contacto = evento.contacto ? contactos.find((c) => c.id === evento.contacto) : undefined
  return contacto ? con(contacto.nombre, contacto.organizacion) : dondeCorto(evento)
}

// En el computador: cada reunión sin tu nota como boleto chico, con "Escribir nota"
export function BoletosSinNota({ reuniones, contactos, onNota }: { reuniones: Evento[]; contactos: Contacto[]; onNota: (id: string) => void }) {
  const textos = useTextos()
  const t = textos.hoy.viaje
  return (
    <div>
      {reuniones.map((e) => (
        <section key={e.id} className={estilos.reunion} aria-labelledby={`sin-nota-${e.id}`}>
          <div className={estilos.boleto}>
            <div className={estilos.cuerpo}>
              <span className={estilos.tipo}>{textos.agenda.tipos[e.tipo]}</span>
              <h2 id={`sin-nota-${e.id}`} className={estilos.titulo}>
                {e.titulo}
              </h2>
              <span className={estilos.cuando}>{conMayuscula(diaLargo(diaEn(e.inicio)))}</span>
              <span className={estilos.cuando}>{t.horario(hora(e.inicio), hora(e.fin))}</span>
            </div>
            <span className={estilos.corte} aria-hidden="true" />
            <span className={estilos.talon}>
              <span className={estilos.ya}>{t.yaPaso[0]}</span>
              <span>{t.yaPaso[1]}</span>
            </span>
          </div>
          <div className={estilos.pie}>
            <span className={estilos.con}>{conQuien(e, contactos, t.con)}</span>
            <button type="button" className={estilos.escribir} onClick={() => onNota(e.id)}>
              <Icono nombre="lapiz" medida={18} trazo={2} />
              {t.escribirNota}
            </button>
          </div>
        </section>
      ))}
    </div>
  )
}

// En el celular: las reuniones sin tu nota, para elegir cuál escribir
export function HojaReuniones({ abierta, reuniones, onNota, onCerrar }: { abierta: boolean; reuniones: Evento[]; onNota: (id: string) => void; onCerrar: () => void }) {
  const t = useTextos().hoy.viaje
  const titulo = t.escribeNotas(reuniones.length)
  return (
    <Hoja abierta={abierta} etiqueta={titulo} onCerrar={onCerrar}>
      <TituloHoja>{titulo}</TituloHoja>
      <ul className={`${estilosHoy.lista} ${estilos.reuniones}`}>
        {reuniones.map((e) => (
          <li key={e.id}>
            <button type="button" className={estilosHoy.pendiente} onClick={() => onNota(e.id)}>
              <Icono nombre="lapiz" medida={20} />
              <span className={estilosHoy.pendienteTexto}>
                <span className={estilos.reunionTitulo}>{e.titulo}</span>
                <span className={estilos.reunionCuando}>{t.cuando(conMayuscula(diaLargo(diaEn(e.inicio))), hora(e.inicio))}</span>
              </span>
              <Icono nombre="derecha" medida={16} trazo={2} />
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  )
}

// Allá hoy: quiénes siguen allá y cuántos eventos tienen hoy
export function AllaHoy({ personas, eventos, onAbrir }: { personas: number; eventos: number; onAbrir: () => void }) {
  const t = useTextos().hoy.viaje
  return (
    <button type="button" className={estilos.alla} onClick={onAbrir}>
      <Icono nombre="grupo" medida={20} />
      <span className={estilos.allaTexto}>
        <span className={estilos.allaLinea}>{t.siguenAlla(personas)}</span>
        <span className={estilos.allaDetalle}>{t.tienenEventos(personas, eventos)}</span>
      </span>
      <Icono nombre="derecha" medida={16} trazo={2} />
    </button>
  )
}

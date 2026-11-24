import { useNavigate } from 'react-router'
import { Atras, BotonPrincipal } from '../../componentes/Controles.tsx'
import { Avatar } from '../../componentes/Avatar.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { usePersonas } from '../../datos/consultas.ts'
import { ahora, diaEn, diaLargo, hora, hoyEnCalifornia } from '../../datos/fechas.ts'
import { soloParaTema, useEventos } from '../../datos/eventos.ts'
import { integrantes } from '../../datos/grupo.ts'
import { eventosDelTema, interesadosDe, leInteresa, puedeCambiarTema, useInteresados, type Tema } from '../../datos/intereses.ts'
import { nombreCompleto, primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { partesDeFecha } from '../tareas/comun.ts'
import { estadoDe } from './estado.ts'
import estilos from './TemaDetalle.module.css'

type Props = {
  tema: Tema
  // En el computador va en la columna de la derecha, sin «‹ Grupo»
  computador: boolean
  sinRed: boolean
  onAtras: () => void
  onEditar: () => void
  onBorrar: () => void
  onSumar: () => void
  onSalir: () => void
}

// Un tema: de qué trata, a quiénes les interesa (con su estadía), sus próximos eventos, quién lo creó y, abajo, «Me
// interesa» o «Ya no me interesa». En el celular ocupa la pantalla; en el computador queda a la derecha.
export function TemaDetalle({ tema, computador, sinRed, onAtras, onEditar, onBorrar, onSumar, onSalir }: Props) {
  const textos = useTextos()
  const t = textos.intereses.tema
  const c = textos.intereses.comun
  const navigate = useNavigate()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const { data: interesados } = useInteresados()
  const { data: eventos } = useEventos()
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona

  const hoy = hoyEnCalifornia()
  const gente = integrantes([yo, ...(personas ?? []).filter((p) => p.id !== yo.id)], yo.id)
  const dentro = new Set(interesadosDe(tema.id, interesados ?? []))
  const quienes = gente.filter((p) => dentro.has(p.id))
  const mio = leInteresa(tema.id, yo.id, interesados ?? [])
  const puede = puedeCambiarTema(tema, yo)
  const proximos = eventosDelTema(tema.id, eventos ?? []).filter((e) => e.fin > ahora())

  const creador = gente.find((p) => p.id === tema.creado_por)
  const dia = diaLargo(diaEn(tema.creado_en))
  const creo = tema.creado_por === yo.id ? t.loCreaste(dia) : creador ? t.loCreo(primerNombre(creador), dia) : null

  const Titulo = computador ? 'h2' : 'h1'
  const encabezado = (
    <div className={estilos.titular}>
      <Titulo className={estilos.titulo}>{tema.nombre}</Titulo>
      {tema.de_que_trata && <p className={estilos.trata}>{tema.de_que_trata}</p>}
    </div>
  )

  const editar = puede && (
    <button type="button" className={estilos.editar} aria-disabled={sinRed} onClick={onEditar}>
      <Icono nombre="lapiz" medida={18} trazo={2} />
      {t.editar}
    </button>
  )

  const cuerpo = (
    <>
      <div className={estilos.rotulo}>
        <h3>{t.aQuienes}</h3>
        <span>{quienes.length}</span>
      </div>
      <ul className={estilos.filas}>
        {quienes.map((p) => {
          const tuyo = p.id === yo.id
          const contenido = (
            <>
              <Avatar persona={p} medida={36} />
              <span className={estilos.quien}>{tuyo ? textos.grupo.tu : nombreCompleto(p)}</span>
              <span className={estilos.estadia}>{estadoDe(p, yo.id, hoy, textos)}</span>
            </>
          )
          return (
            <li key={p.id} className={estilos.fila}>
              {tuyo || p.entro_en ? (
                <button type="button" className={estilos.abrir} onClick={() => navigate(tuyo ? '/perfil' : `/grupo/${p.id}`, { state: { volverA: `/grupo/intereses/${tema.id}`, volverTexto: tema.nombre } })}>
                  {contenido}
                </button>
              ) : (
                <div className={estilos.abrir}>{contenido}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className={`${estilos.rotulo} ${estilos.separado}`}>
        <h3>{t.proximos}</h3>
      </div>
      {proximos.length === 0 ? (
        <p className={estilos.sinEventos}>{t.sinEventos(tema.nombre)}</p>
      ) : (
        <ul className={estilos.filas}>
          {proximos.map((e) => {
            const fecha = partesDeFecha(diaEn(e.inicio))
            return (
              <li key={e.id} className={estilos.fila}>
                <button type="button" className={estilos.abrir} onClick={() => navigate(`/agenda/${e.id}`, { state: { desdeAqui: true } })}>
                  <span className={estilos.fecha}>
                    <small>{fecha.semana}</small>
                    <b>{fecha.dia}</b>
                  </span>
                  <span className={estilos.evento}>
                    <span className={estilos.eventoTitulo}>{e.titulo}</span>
                    <span className={estilos.eventoMeta}>{t.linea(hora(e.inicio), soloParaTema(e) ? t.soloElTema : t.paraTodos)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {creo && <p className={estilos.creo}>{creo}</p>}
      {puede && (
        <button type="button" className={estilos.borrar} aria-disabled={sinRed} onClick={onBorrar}>
          {t.borrar}
        </button>
      )}
    </>
  )

  // Sin conexión «Me interesa» queda apagado, pero tocarlo avisa
  const pie = mio ? (
    <div className={estilos.pieDentro}>
      <span className={estilos.teInteresa}>
        <Icono nombre="check" medida={18} trazo={2.25} />
        {c.teInteresa}
      </span>
      <button type="button" className={estilos.salir} aria-disabled={sinRed} onClick={onSalir}>
        {c.yaNoMeInteresa}
      </button>
    </div>
  ) : (
    <div onClick={() => sinRed && onSumar()}>
      <BotonPrincipal apagado={sinRed} onClick={onSumar}>
        {c.meInteresa}
      </BotonPrincipal>
    </div>
  )

  if (computador) {
    return (
      <section aria-label={tema.nombre} className={estilos.tarjeta}>
        <div className={estilos.franja}>
          <div className={estilos.cabecera}>
            <SinConexion sobrePanel />
            {editar}
          </div>
          {encabezado}
        </div>
        <div className={estilos.contenido}>{cuerpo}</div>
        <div className={estilos.pieTarjeta}>{pie}</div>
      </section>
    )
  }

  return (
    <PantallaConPie pie={pie}>
      <div className={`${estilos.franja} ${estilos.franjaCel}`}>
        <div className={`${estilos.cabecera} ${estilos.cabeceraCel}`}>
          <Atras texto={t.atras} onClick={onAtras} />
          <span className={estilos.derecha}>
            <SinConexion sobrePanel />
            {editar}
          </span>
        </div>
        {encabezado}
      </div>
      <div className={estilos.cuerpo}>{cuerpo}</div>
    </PantallaConPie>
  )
}

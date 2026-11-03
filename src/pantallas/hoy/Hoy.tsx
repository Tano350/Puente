import { useNavigate } from 'react-router'
import { Icono, type NombreIcono } from '../../componentes/Icono.tsx'
import { Tuerca } from '../../componentes/Tuerca.tsx'
import { useContactos } from '../../datos/contactos.ts'
import { conMayuscula, diaLargo, diasEntre, hoyAqui } from '../../datos/fechas.ts'
import { useSesion, type Persona } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'
import estilos from './Hoy.module.css'

// La ficha de arriba: el día y, en la tuerca, cuánto falta, qué día del viaje es o hace cuánto volviste
function ficha(persona: Persona, hoy: string, textos: Textos): { fecha: string; detalle: string | null; tuerca: string[] | null } {
  const t = textos.hoy
  const fecha = conMayuscula(diaLargo(hoy))
  const { llega, vuelve } = persona
  if (!llega || !vuelve) return { fecha, detalle: null, tuerca: null }
  if (hoy < llega) return { fecha, detalle: t.llegasEl(diaLargo(llega)), tuerca: t.faltan(diasEntre(hoy, llega) - 1) }
  if (hoy > vuelve) return { fecha, detalle: t.volvisteEl(diaLargo(vuelve)), tuerca: t.hace(diasEntre(vuelve, hoy) - 1) }
  return { fecha, detalle: null, tuerca: t.diaDelViaje(diasEntre(llega, hoy)) }
}

export function Hoy() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const { data: contactos } = useContactos()
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const t = textos.hoy
  const { fecha, detalle, tuerca } = ficha(persona, hoyAqui(), textos)

  // Pendientes: tus contactos por contactar y lo que falta en tu perfil (los eventos por confirmar llegan con Agenda)
  const pendientes: { texto: string; icono: NombreIcono; ir: () => void }[] = []
  const porContactar = (contactos ?? []).filter((c) => c.responsable === persona.id && c.etapa === 'por_contactar')
  if (porContactar.length === 1) pendientes.push({ texto: t.escribeA(porContactar[0].nombre), icono: 'contactos', ir: () => navigate(`/contactos/${porContactar[0].id}`) })
  if (porContactar.length > 1) pendientes.push({ texto: t.escribeAVarios(porContactar.length), icono: 'contactos', ir: () => navigate('/contactos') })
  const editarPerfil = () => navigate('/perfil', { state: { abrir: 'editar' } })
  if (!persona.emprendimiento) pendientes.push({ texto: t.agregaEmprendimiento, icono: 'perfil', ir: editarPerfil })
  if (!persona.objetivos) pendientes.push({ texto: t.agregaObjetivos, icono: 'perfil', ir: editarPerfil })
  if (!persona.linkedin) pendientes.push({ texto: t.agregaLinkedin, icono: 'perfil', ir: editarPerfil })

  return (
    <div className={estilos.hoy}>
      <header className={estilos.ficha}>
        <div>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          <p className={estilos.fecha}>{fecha}</p>
          {detalle && <p className={estilos.detalle}>{detalle}</p>}
        </div>
        {tuerca && (
          <div className={estilos.tuerca}>
            <Tuerca ancho={104} />
            <span className={estilos.cuenta}>
              <span className={estilos.chico}>{tuerca[0]}</span>
              <span className={estilos.numero}>{tuerca[1]}</span>
              <span className={estilos.chico}>{tuerca[2]}</span>
            </span>
          </div>
        )}
      </header>
      <div className={estilos.contenido}>
        <section className={estilos.pendientes} aria-labelledby="hoy-pendientes">
          <h2 id="hoy-pendientes" className={estilos.cinta}>
            {t.pendientes}
          </h2>
          {pendientes.length > 0 ? (
            <ul className={estilos.lista}>
              {pendientes.map(({ texto, icono, ir }) => (
                <li key={texto}>
                  <button type="button" className={estilos.pendiente} onClick={ir}>
                    <Icono nombre={icono} medida={20} />
                    <span className={estilos.pendienteTexto}>{texto}</span>
                    <Icono nombre="derecha" medida={16} trazo={2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={estilos.sinPendientes}>{t.sinPendientes}</p>
          )}
        </section>
      </div>
    </div>
  )
}

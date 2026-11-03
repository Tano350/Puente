import { useNavigate } from 'react-router'
import { Icono } from '../../componentes/Icono.tsx'
import { Tuerca } from '../../componentes/Tuerca.tsx'
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
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const t = textos.hoy
  const { fecha, detalle, tuerca } = ficha(persona, hoyAqui(), textos)
  // Por ahora los pendientes son del perfil; los contactos y eventos por confirmar llegan con sus secciones
  const pendientes = [
    { falta: !persona.emprendimiento, texto: t.agregaEmprendimiento },
    { falta: !persona.objetivos, texto: t.agregaObjetivos },
    { falta: !persona.linkedin, texto: t.agregaLinkedin },
  ].filter((p) => p.falta)

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
              {pendientes.map(({ texto }) => (
                <li key={texto}>
                  <button type="button" className={estilos.pendiente} onClick={() => navigate('/perfil', { state: { abrir: 'editar' } })}>
                    <Icono nombre="perfil" medida={20} />
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

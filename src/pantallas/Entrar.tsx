import { Tuerca } from '../componentes/Tuerca.tsx'
import { useSesion } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import estilos from './Entrar.module.css'

// El puente colgante del diseño, dibujado con líneas
function Dibujo() {
  return (
    <svg className={estilos.dibujo} viewBox="0 0 300 150" fill="none" aria-hidden="true">
      <path d="M0 112 H300" stroke="var(--regla)" strokeWidth="3" />
      <path d="M78 112 V24 M222 112 V24" stroke="var(--tinta)" strokeWidth="5" />
      <path d="M70 30 H86 M214 30 H230 M72 60 H84 M216 60 H228" stroke="var(--tinta)" strokeWidth="3" />
      <path d="M0 70 Q40 66 78 26 Q150 104 222 26 Q260 66 300 70" stroke="var(--acento)" strokeWidth="2.5" />
      <path
        d="M100 50 V112 M122 66 V112 M150 71 V112 M178 66 V112 M200 50 V112 M30 62 V112 M54 50 V112 M246 50 V112 M270 62 V112"
        stroke="var(--regla)"
        strokeWidth="1.5"
      />
      <path d="M0 126 H300" stroke="var(--borde)" strokeWidth="2" strokeDasharray="6 6" />
    </svg>
  )
}

function LogoGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function Entrar() {
  const sesion = useSesion()
  const { entrar: textos } = useTextos()
  const noInvitado = sesion.tipo === 'noInvitado' ? sesion : null

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.centro}>
        <Dibujo />
        <div className={estilos.marca}>
          <Tuerca ancho={40} />
          <span className={estilos.nombre}>Puente</span>
        </div>
        <div className={estilos.viaje}>{textos.viaje}</div>
        {noInvitado && (
          <div role="alert" className={estilos.alerta}>
            <div className={estilos.alertaTitulo}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {textos.noInvitada}
            </div>
            <div className={estilos.alertaTexto}>
              {noInvitado.correo ? textos.entrasteComo(noInvitado.correo) : textos.avisale}
            </div>
          </div>
        )}
      </div>
      <button type="button" className={estilos.google} onClick={() => void (noInvitado ? sesion.probarOtraCuenta() : sesion.entrar())}>
        <LogoGoogle />
        {noInvitado ? textos.otraCuenta : textos.conGoogle}
      </button>
      <div className={estilos.nota}>{textos.soloInvitados}</div>
    </main>
  )
}

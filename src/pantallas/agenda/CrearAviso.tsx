import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Aviso } from '../../componentes/Controles.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useTextos } from '../../textos.ts'

// "Nuevo" se cierra al marcar un rato ocupado, así que su aviso se pinta aparte y se quita solo al terminar.
// Usa el useAviso de siempre: si otra pantalla muestra un aviso, este se cierra.
export function avisarAlCerrar(texto: string, deshacer: () => Promise<unknown>) {
  const lugar = document.body.appendChild(document.createElement('div'))
  const raiz = createRoot(lugar)
  const quitar = () =>
    window.setTimeout(() => {
      raiz.unmount()
      lugar.remove()
    })
  raiz.render(<AvisoAparte texto={texto} deshacer={deshacer} onTerminar={quitar} />)
}

function AvisoAparte({ texto, deshacer, onTerminar }: { texto: string; deshacer: () => Promise<unknown>; onTerminar: () => void }) {
  const textos = useTextos()
  const aviso = useAviso()
  const [mostrado, setMostrado] = useState(false)
  useEffect(() => {
    aviso.mostrar(texto, async () => {
      try {
        await deshacer()
        aviso.cerrar()
      } catch {
        aviso.mostrar(textos.noSeGuardo)
      }
    })
    setMostrado(true)
    // Se muestra una sola vez, al pintarse
  }, [])
  useEffect(() => {
    if (mostrado && !aviso.texto) onTerminar()
  }, [mostrado, aviso.texto, onTerminar])
  return <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
}

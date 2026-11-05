import { olvidarRechazos, useRechazos } from '../datos/sinSenal.ts'
import { textoRechazos } from '../datos/rechazos.ts'
import { useTextos } from '../textos.ts'
import { Aviso } from './Controles.tsx'

// Lo escrito sin señal que la base rechazó al subir: se avisa en cualquier pantalla y se queda hasta "Entendido"
// (también si se cierra y se abre la app), para que nada desaparezca sin decirlo.
export function AvisoRechazos() {
  const t = useTextos()
  const rechazos = useRechazos()
  const texto = textoRechazos(rechazos, t.rechazos, t.y)
  return <Aviso texto={texto} accion={{ texto: t.rechazos.entendido, alHacer: olvidarRechazos }} arriba />
}

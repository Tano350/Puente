import { Link } from 'react-router'
import { useSesion } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import { Avatar } from './Avatar.tsx'
import { useEsComputador } from './useEsComputador.ts'
import estilos from './EntradaPerfil.module.css'

// La entrada a Tu perfil en el celular: tu foto, arriba a la derecha de Hoy y de Grupo. En el computador no hace falta:
// "Perfil" está en la barra lateral.
export function EntradaPerfil() {
  const esComputador = useEsComputador()
  const sesion = useSesion()
  const textos = useTextos()
  if (esComputador || sesion.tipo !== 'dentro') return null
  return (
    <Link to="/perfil" className={estilos.entrada} aria-label={textos.perfil.titulo}>
      <Avatar persona={sesion.persona} medida={36} />
    </Link>
  )
}

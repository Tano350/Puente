import type { NombreIcono } from '../../componentes/Icono.tsx'
import { CATEGORIAS, type Categoria } from '../../datos/gastos.ts'

// El ícono de cada categoría; "otro" usa el de Gastos
export function iconoDe(categoria: string): NombreIcono {
  return categoria !== 'otro' && (CATEGORIAS as readonly string[]).includes(categoria) ? (categoria as Exclude<Categoria, 'otro'>) : 'gastos'
}

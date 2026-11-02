// La tuerca de Puente: hexágono con agujero, en una caja de 104 × 90.
const forma = 'M26 0H78L104 45L78 90H26L0 45ZM52 9A36 36 0 1 0 52 81A36 36 0 1 0 52 9Z'

export function Tuerca({ ancho }: { ancho: number }) {
  return (
    <svg width={ancho} height={(ancho * 90) / 104} viewBox="0 0 104 90" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={forma} />
    </svg>
  )
}

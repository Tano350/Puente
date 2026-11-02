// Íconos de trazo del lienzo, en una grilla de 24.
const trazos = {
  hoy: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M3 12h1M12 3v1M20 12h1M12 20v1M5.6 5.6l.7.7M18.4 5.6l-.7.7M17.7 17.7l.7.7M6.3 17.7l-.7.7" />
    </>
  ),
  agenda: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M4 11h16" />
    </>
  ),
  contactos: (
    <>
      <rect x="6" y="3" width="14" height="18" rx="2" />
      <path d="M10 16h6" />
      <circle cx="13" cy="10" r="2" />
      <path d="M4 8h3M4 12h3M4 16h3" />
    </>
  ),
  gastos: (
    <>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  grupo: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </>
  ),
}

export type NombreIcono = keyof typeof trazos

export function Icono({ nombre, medida = 24 }: { nombre: NombreIcono; medida?: number }) {
  return (
    <svg
      width={medida}
      height={medida}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {trazos[nombre]}
    </svg>
  )
}

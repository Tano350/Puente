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
  izquierda: <path d="M15 6l-6 6l6 6" />,
  derecha: <path d="M9 6l6 6l-6 6" />,
  abajo: <path d="M6 9l6 6l6-6" />,
  check: <path d="M5 12l5 5L20 7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  lapiz: (
    <>
      <path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  linkedin: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 0 0-4 0" />
    </>
  ),
  compartir: <path d="M8 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1M12 14V3M9 6l3-3l3 3" />,
  agregarInicio: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  avisos: (
    <>
      <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </>
  ),
  instalar: (
    <>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M7 11l5 5l5-5M12 4v12" />
    </>
  ),
}

export type NombreIcono = keyof typeof trazos

export function Icono({ nombre, medida = 24, trazo = 1.75 }: { nombre: NombreIcono; medida?: number; trazo?: number }) {
  return (
    <svg
      width={medida}
      height={medida}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {trazos[nombre]}
    </svg>
  )
}

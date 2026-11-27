/**
 * Logo de Amarilla Gas: garrafa con llama + "AMARILLA GAS".
 * Los SVG están en /public/img (fuente y generador en docs/logo).
 * - color: para fondos amarillos o blancos (garrafa negra).
 * - blanco: para fondos oscuros (garrafa amarilla, texto blanco).
 */
export function Logo({ variant = 'color', className = 'h-10' }: { variant?: 'color' | 'blanco'; className?: string }) {
  return (
    <img
      src={variant === 'blanco' ? '/img/logo-oscuro.svg' : '/img/logo.svg'}
      alt="Amarilla Gas"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  )
}

export function Isotipo({ className = 'h-8' }: { className?: string }) {
  return <img src="/img/isotipo.svg" alt="" aria-hidden className={`w-auto select-none ${className}`} draggable={false} />
}

/** Logo horizontal para la barra superior: garrafa + nombre en una línea. */
export function LogoHorizontal({ variant = 'color', className = 'h-8' }: { variant?: 'color' | 'blanco'; className?: string }) {
  return (
    <img
      src={variant === 'blanco' ? '/img/logo-horizontal-oscuro.svg' : '/img/logo-horizontal.svg'}
      alt="Amarilla Gas"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  )
}

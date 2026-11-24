export function Logo({ variant = 'color', className = 'h-10' }: { variant?: 'color' | 'blanco'; className?: string }) {
  return (
    <img
      src={variant === 'blanco' ? '/img/logo-blanco.png' : '/img/logo.png'}
      alt="Amarilla Gas"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  )
}

export function Isotipo({ className = 'h-8' }: { className?: string }) {
  return <img src="/img/isotipo.png" alt="" aria-hidden className={`w-auto select-none ${className}`} draggable={false} />
}

/** Logo horizontal para la barra superior: isotipo + nombre en una línea. */
export function LogoHorizontal({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Amarilla Gas">
      <Isotipo className="h-7" />
      <span className="font-display text-[19px] leading-none tracking-tight text-ink">
        <b className="font-extrabold">AMARILLA</b>
        <span className="font-medium">GAS</span>
      </span>
    </span>
  )
}

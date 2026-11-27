import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Phone, Sparkles, X } from 'lucide-react'

/**
 * Promoción de bienvenida: canje del envase de chapa de 10 kg por uno plástico.
 * El cliente la puede cerrar; queda cerrada en ese navegador (cambiar PROMO_ID para volver a mostrar una promo nueva).
 * El precio promocional se coordina por teléfono: la app no lo cobra automáticamente.
 */
const PROMO_ID = 'canje-chapa-plastico-10kg'
const PRICE = '$ 90.000'
const PHONE = '0800-555-2642'
const TEL = 'tel:08005552642'

export type PromoVariant = 'valla' | 'tarjeta' | 'cinta'

function useDismiss() {
  const key = `promo-cerrada:${PROMO_ID}`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
  }
  return [hidden, close] as const
}

const CloseBtn = ({ onClick, dark }: { onClick: () => void; dark?: boolean }) => (
  <button
    onClick={onClick}
    aria-label="Cerrar promoción"
    className={`absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 text-ink hover:bg-black/20'}`}
  >
    <X className="size-4" />
  </button>
)

const Swap = ({ size = 'size-16 md:size-20' }: { size?: string }) => (
  <div className="flex shrink-0 items-center gap-1" aria-hidden>
    <span className="overflow-hidden rounded-2xl bg-white p-1.5 opacity-75">
      <img src="/img/garrafa-chapa-10.png" alt="" className={`${size} rounded-xl object-contain grayscale-[40%]`} />
    </span>
    <ArrowRight className="size-6 shrink-0 text-brand" strokeWidth={3} />
    <span className="overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_0_24px_rgba(255,176,29,0.55)] ring-2 ring-brand">
      <img src="/img/garrafa-plastica-10.png" alt="" className={`${size} rounded-xl object-contain`} />
    </span>
  </div>
)

/**
 * - dismissible: muestra la X para cerrarla (en el catálogo). En la bienvenida y el inicio de sesión queda fija.
 * - signup: el botón invita a registrarse en lugar de llamar (para quien todavía no tiene cuenta).
 */
export function PromoBanner({ variant = 'valla', dismissible = true, signup = false, className = '' }: { variant?: PromoVariant; dismissible?: boolean; signup?: boolean; className?: string }) {
  const [hiddenSaved, closeSaved] = useDismiss()
  const hidden = dismissible && hiddenSaved
  const close = closeSaved
  if (hidden) return null
  const cta = (cls: string, label: string) =>
    signup ? (
      <Link to="/registro" className={cls}>
        <ArrowRight className="size-4" /> Registrate y aprovechala
      </Link>
    ) : (
      <a href={TEL} className={cls}>
        <Phone className="size-4" /> {label}
      </a>
    )

  if (variant === 'cinta')
    return (
      <section aria-label="Promoción" className={`relative overflow-hidden rounded-xl bg-ink py-2.5 pl-4 ${dismissible ? 'pr-11' : 'pr-4'} text-white ${className || 'mb-4'}`}>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <Sparkles className="size-4 text-brand" />
          <b className="font-display text-brand">PROMO CANJE</b>
          <span>Tu garrafa de chapa 10 kg por una plástica pagando solo la diferencia:</span>
          <b className="font-display text-base text-brand">{PRICE}</b>
          {signup ? (
            <Link to="/registro" className="font-bold underline underline-offset-2">
              Registrate
            </Link>
          ) : (
            <a href={TEL} className="font-bold underline underline-offset-2">
              Pedila
            </a>
          )}
        </p>
        {dismissible && <CloseBtn onClick={close} dark />}
      </section>
    )

  if (variant === 'tarjeta')
    return (
      <section
        aria-label="Promoción"
        className={`relative overflow-hidden rounded-2xl bg-brand p-5 shadow-card ${className || 'mb-5'}`}
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(31,31,28,0.06) 0 14px, transparent 14px 28px)' }}
      >
        {dismissible && <CloseBtn onClick={close} />}
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex-1 text-center sm:text-left">
            <span className="chip bg-ink text-brand">Promo de bienvenida</span>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">
              Pasate a la garrafa plástica
            </h2>
            <p className="mt-1 text-sm text-ink-2">Traé tu envase de chapa de 10 kg y llevate uno plástico: más liviano, no se oxida y ves cuánto gas te queda.</p>
          </div>
          <div className="relative">
            <span className="block overflow-hidden rounded-full bg-white p-3 shadow-card">
              <img src="/img/garrafa-plastica-10.png" alt="" className="size-24 rounded-full object-contain" aria-hidden />
            </span>
            <span className="absolute -bottom-2 -right-6 grid size-24 rotate-[-8deg] place-items-center rounded-full bg-ink text-center font-display text-white shadow-lg">
              <span>
                <span className="block text-[10px] font-bold uppercase text-brand">Solo</span>
                <span className="block text-lg font-extrabold leading-none">{PRICE}</span>
                <span className="block text-[9px] text-white/70">la diferencia</span>
              </span>
            </span>
          </div>
        </div>
        {cta('btn-dark mt-4 w-full sm:w-auto', 'Quiero canjear mi envase')}
      </section>
    )

  // Valla (recomendada): banda negra, contraste máximo con el amarillo de la marca
  return (
    <section aria-label="Promoción" className={`relative overflow-hidden rounded-2xl bg-ink text-white shadow-card ${className || 'mb-5'}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(135deg,#ffb01d_0_12px,#1f1f1c_12px_24px)]" aria-hidden />
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/20 blur-2xl" aria-hidden />
      {dismissible && <CloseBtn onClick={close} dark />}
      <div className="relative flex flex-col gap-4 p-5 pt-6 md:flex-row md:items-center md:gap-6">
        <div className="flex-1">
          <p className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-brand">
            <Sparkles className="size-4" /> Promo canje · Bienvenida
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight md:text-3xl">
            Cambiá tu garrafa de <span className="text-white/60 line-through decoration-brand decoration-2">chapa</span>{' '}
            <span className="text-brand">por plástica</span>
          </h2>
          <p className="mt-1 text-sm text-white/75">Envase de 10 kg. Entregás el tuyo de chapa y pagás solo la diferencia.</p>
        </div>
        <div className="flex items-center justify-between gap-4 md:justify-end">
          <Swap />
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase text-white/60">Solo pagás</p>
            <p className="whitespace-nowrap font-display text-2xl font-extrabold leading-none text-brand sm:text-3xl md:text-4xl">{PRICE}</p>
            <p className="text-[11px] text-white/60">solo el envase</p>
          </div>
        </div>
      </div>
      <div className="relative flex flex-col gap-2 border-t border-white/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/60">
          {signup ? 'Creá tu cuenta gratis y coordinamos el canje.' : `Coordinamos el canje por teléfono al ${PHONE}.`}
        </p>
        {cta('btn-primary py-2.5 text-sm', 'Quiero canjear')}
      </div>
    </section>
  )
}

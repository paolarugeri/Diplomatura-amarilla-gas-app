import { useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight, Clock, MapPin, ShieldCheck, ShoppingCart, Sparkles, Truck } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui'
import { homeFor } from '../lib/home'

const PROMO_PRICE = '$ 90.000'

/**
 * Animación de la garrafa según el desplazamiento (rueda del mouse, barra o dedo en el celular):
 * - al bajar, la garrafa de chapa se achica y se corre, y la plástica pasa adelante (el "canje");
 * - la garrafa se inclina hacia el lado en que se desplaza y vuelve sola a su lugar;
 * - el sello del precio gira con el desplazamiento.
 * Se escribe directo en el estilo (sin re-renderizar) y se desactiva si el usuario pidió menos movimiento.
 */
function useScrollGarrafa() {
  const stage = useRef<HTMLDivElement>(null)
  const plastic = useRef<HTMLImageElement>(null)
  const chapa = useRef<HTMLImageElement>(null)
  const seal = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let lastY = window.scrollY
    let tilt = 0
    let push = 0 // impulso extra de la rueda cuando la página no se puede desplazar más

    const frame = () => {
      const y = window.scrollY
      const v = y - lastY
      lastY = y
      const target = Math.max(-22, Math.min(22, v * 1.2 + push))
      tilt += (target - tilt) * 0.12
      push *= 0.9

      const p = Math.max(0, Math.min(1, y / 220)) // avance del canje
      const t = performance.now() / 1000
      const bob = Math.sin(t * 1.6) * 8

      if (plastic.current)
        plastic.current.style.transform = `translate3d(${-p * 18}px, ${bob - p * 30}px, 0) rotate(${tilt}deg) scale(${0.92 + p * 0.16})`
      if (chapa.current) {
        chapa.current.style.transform = `translate3d(${p * 60}px, ${Math.sin(t * 1.6 + 1.2) * 5 + p * 30}px, 0) rotate(${8 + tilt * 0.4 + p * 10}deg) scale(${1 - p * 0.3})`
        chapa.current.style.opacity = String(1 - p * 0.65)
        chapa.current.style.filter = `grayscale(${p * 0.8}) blur(${p * 1.5}px)`
      }
      if (seal.current) seal.current.style.transform = `rotate(${-12 + y * 0.25 + tilt}deg) scale(${1 + Math.abs(tilt) / 80})`
      if (glow.current) glow.current.style.transform = `scale(${1 + p * 0.25 + Math.sin(t * 2) * 0.03})`
      raf = requestAnimationFrame(frame)
    }

    const onWheel = (e: WheelEvent) => {
      push = Math.max(-22, Math.min(22, push + e.deltaY * 0.05))
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  return { stage, plastic, chapa, seal, glow }
}

function PromoTopBar() {
  return (
    <div className="relative z-20 bg-ink text-white">
      <div className="h-1 bg-[repeating-linear-gradient(135deg,#ffb01d_0_12px,#1f1f1c_12px_24px)]" aria-hidden />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm">
        <span className="flex items-center gap-1.5 font-display font-extrabold uppercase tracking-wider text-brand">
          <Sparkles className="size-4" /> Promo canje
        </span>
        <span>
          Tu garrafa de chapa de 10 kg por una <b>plástica</b> pagando solo <b className="font-display text-brand">{PROMO_PRICE}</b>
        </span>
        <Link to="/registro" className="inline-flex items-center gap-1 font-bold text-brand underline-offset-4 hover:underline">
          Aprovechala <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

export default function Welcome() {
  const { session, profile, loading } = useAuth()
  const g = useScrollGarrafa()
  if (!loading && session && !profile) return <PageLoader />
  if (!loading && session) return <Navigate to={homeFor(profile?.role)} replace />

  return (
    <div className="min-h-dvh overflow-x-hidden bg-brand">
      <PromoTopBar />

      <section className="relative">
        {/* Curva decorativa inspirada en el flyer */}
        <svg className="pointer-events-none absolute -bottom-1 left-0 w-[160%] max-w-none text-white md:w-full" viewBox="0 0 1440 220" aria-hidden>
          <path fill="currentColor" d="M0 160 C 360 40, 900 40, 1440 150 L1440 220 L0 220 Z" />
        </svg>

        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-5 pb-20 pt-4 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pb-32 md:pt-10">
          <div className="text-center md:text-left">
            <div className="mx-auto w-fit rounded-3xl bg-white px-5 py-3 shadow-card md:mx-0 md:px-6 md:py-4">
              <Logo className="h-11 md:h-20" />
            </div>
            <h1 className="mt-4 text-[30px] md:mt-6 font-extrabold leading-[1.05] text-ink md:text-[46px] lg:text-[56px]">
              Tu gas, en tu casa,
              <br />
              en pocos pasos.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-ink/80 md:mx-0 md:text-lg">
              Pedí garrafas y cargas de GLP online y seguí la entrega a domicilio desde el celular.
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-3 md:mx-0">
              <Link to="/ingresar" className="btn-dark py-3.5 text-base">
                Iniciar sesión
              </Link>
              <Link to="/registro" className="btn bg-white py-3.5 text-base text-ink shadow-sm hover:bg-white/90">
                Registrarme
              </Link>
              <Link to="/catalogo" className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-bold text-ink underline-offset-4 hover:underline md:justify-start">
                Ver catálogo y precios <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Escenario animado: la plástica reemplaza a la de chapa al desplazarse */}
          <div ref={g.stage} className="relative mx-auto -order-1 h-[250px] w-full max-w-[340px] md:order-none md:h-[460px] md:max-w-none" aria-hidden>
            <div ref={g.glow} className="absolute left-1/2 top-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 blur-2xl md:size-[400px]" />
            <div className="absolute left-1/2 top-1/2 size-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-white/40 md:size-[380px]" />
            <img
              ref={g.chapa}
              src="/img/garrafa-chapa-10-recorte.png"
              alt=""
              className="absolute bottom-6 left-[14%] h-[140px] origin-bottom drop-shadow-[0_18px_20px_rgba(0,0,0,0.25)] will-change-transform md:bottom-14 md:h-[260px]"
              style={{ transform: 'rotate(8deg)' }}
            />
            <img
              ref={g.plastic}
              src="/img/garrafa-plastica-10-recorte.png"
              alt=""
              className="absolute bottom-4 right-[16%] h-[190px] origin-bottom drop-shadow-[0_24px_24px_rgba(0,0,0,0.3)] will-change-transform md:bottom-10 md:h-[360px]"
            />
            <div
              ref={g.seal}
              className="absolute right-[2%] top-[6%] grid size-[96px] place-items-center rounded-full bg-ink text-center font-display text-white shadow-xl will-change-transform md:right-[4%] md:top-[8%] md:size-[140px]"
              style={{ transform: 'rotate(-12deg)' }}
            >
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-brand md:text-xs">Canje solo</span>
                <span className="block text-xl font-extrabold leading-none md:text-[28px]">{PROMO_PRICE}</span>
                <span className="block text-[9px] text-white/70 md:text-[11px]">chapa → plástica</span>
              </span>
            </div>
            <ChevronDown className="absolute -bottom-2 left-1/2 size-6 -translate-x-1/2 animate-bounce text-ink/60 md:hidden" />
          </div>
        </div>
      </section>

      <section className="bg-white pb-12">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="mb-4 text-center text-2xl font-extrabold">Pedir es así de fácil</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: MapPin, title: '1. Cargá tu domicilio', text: 'Lo marcás una vez en el mapa.' },
              { icon: ShoppingCart, title: '2. Elegí tu garrafa', text: 'Carga sola o envase nuevo, con precio al instante.' },
              { icon: Truck, title: '3. Te lo llevamos', text: 'Seguí el camión hasta tu puerta.' },
            ].map(({ icon: I, title, text }) => (
              <li key={title} className="rounded-2xl bg-ink p-4 text-white">
                <I className="size-6 text-brand" />
                <b className="mt-2 block font-display">{title}</b>
                <span className="text-sm text-white/70">{text}</span>
              </li>
            ))}
          </ol>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: 'Envases certificados', text: 'Garrafas controladas y precintadas.' },
              { icon: Truck, title: 'Entrega a domicilio', text: 'Te lo llevamos a la dirección que elijas.' },
              { icon: Clock, title: 'Seguimiento online', text: 'Consultá el estado de tu pedido cuando quieras.' },
            ].map(({ icon: I, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-cream p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-ink">
                  <I className="size-5" />
                </span>
                <span>
                  <b className="block font-display text-sm">{title}</b>
                  <span className="text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

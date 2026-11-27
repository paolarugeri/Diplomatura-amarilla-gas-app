import { Link, Navigate } from 'react-router-dom'
import { Clock, ShieldCheck, Truck, ChevronRight } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui'
import { homeFor } from '../lib/home'
import { PromoBanner } from '../components/PromoBanner'

export default function Welcome() {
  const { session, profile, loading } = useAuth()
  if (!loading && session && !profile) return <PageLoader />
  if (!loading && session) return <Navigate to={homeFor(profile?.role)} replace />

  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand">
      {/* Curva decorativa inspirada en el flyer */}
      <svg className="pointer-events-none absolute -bottom-24 left-0 w-[160%] max-w-none text-white md:w-full" viewBox="0 0 1440 400" aria-hidden>
        <path fill="currentColor" d="M0 260 C 360 120, 900 120, 1440 240 L1440 400 L0 400 Z" />
      </svg>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-8 pt-8 md:flex-row md:items-center md:gap-10 md:pt-0">
        <div className="flex flex-1 flex-col md:py-16">
          <div className="mx-auto w-fit rounded-3xl bg-white px-7 py-5 shadow-card md:mx-0">
            <Logo className="h-20 md:h-24" />
          </div>

          <h1 className="mt-8 text-center text-[28px] font-extrabold leading-tight text-ink md:text-left md:text-5xl">
            Tu gas, en tu casa,
            <br />
            en pocos pasos.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-[15px] text-ink/80 md:mx-0 md:text-left md:text-lg">
            Bienvenido al canal de pedidos online de Amarilla Gas. Comprá garrafas y cargas de GLP y coordiná la entrega
            a domicilio de forma simple y segura.
          </p>

          <div className="mx-auto mt-7 flex w-full max-w-sm flex-col gap-3 md:mx-0">
            <Link to="/ingresar" className="btn-dark py-3.5 text-base">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="btn bg-white py-3.5 text-base text-ink shadow-sm hover:bg-white/90">
              Registrarme
            </Link>
            <Link to="/catalogo" className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-bold text-ink underline-offset-4 hover:underline">
              Ver catálogo y precios <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="relative mt-10 flex flex-1 items-end justify-center gap-2 md:mt-0">
          <img src="/img/garrafa-plastica-10.png" alt="Garrafa plástica de 10 kg" className="h-44 rounded-3xl object-cover shadow-xl md:h-72" />
          <img src="/img/garrafa-chapa-10.png" alt="Garrafa de chapa de 10 kg" className="z-10 h-52 rounded-3xl object-cover shadow-xl md:h-80" />
          <img src="/img/garrafa-45.png" alt="Tubo de 45 kg" className="h-48 rounded-3xl object-cover shadow-xl md:h-80" />
        </div>
      </div>

      <div className="relative -mt-2 bg-white pb-10">
        <div className="mx-auto max-w-4xl px-5 pb-6">
          <PromoBanner dismissible={false} signup className="mb-0" />
        </div>
        <ul className="mx-auto grid max-w-4xl gap-3 px-5 sm:grid-cols-3">
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
    </div>
  )
}

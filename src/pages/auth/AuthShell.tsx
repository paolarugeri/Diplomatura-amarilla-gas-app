import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../../components/Logo'

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-brand md:grid md:place-items-center md:py-10">
      <div className="px-5 pb-6 pt-5 md:hidden">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-ink">
          <ChevronLeft className="size-4" /> Inicio
        </Link>
        <div className="mt-3 flex justify-center">
          <div className="rounded-2xl bg-white px-5 py-3 shadow-card">
            <Logo className="h-12" />
          </div>
        </div>
      </div>
      <div className="min-h-[calc(100dvh-150px)] rounded-t-[28px] bg-white px-5 pb-10 pt-7 md:min-h-0 md:w-full md:max-w-md md:rounded-3xl md:p-8 md:shadow-xl">
        <div className="mb-6 hidden justify-center md:flex">
          <Link to="/">
            <Logo className="h-16" />
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}

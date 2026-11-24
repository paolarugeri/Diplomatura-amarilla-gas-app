import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Minus, Plus } from 'lucide-react'
import type { OrderStatus, PaymentStatus } from '../lib/types'
import { orderStatusLabel, paymentStatusLabel } from '../lib/format'

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-700 ${className}`} aria-label="Cargando" />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  icon?: ReactNode
  right?: ReactNode
}

export function Field({ label, error, hint, id, icon, right, ...rest }: FieldProps) {
  const fid = id ?? rest.name
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
        <input
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : undefined}
          className={`input ${icon ? 'pl-11' : ''} ${right ? 'pr-12' : ''}`}
          {...rest}
        />
        {right && <span className="absolute right-2 top-1/2 -translate-y-1/2">{right}</span>}
      </div>
      {error ? (
        <p id={`${fid}-error`} className="mt-1.5 text-sm font-semibold text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: ReactNode
}
export function SelectField({ label, error, id, children, ...rest }: SelectProps) {
  const fid = id ?? rest.name
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <select id={fid} aria-invalid={error ? true : undefined} className="input appearance-auto" {...rest}>
        {children}
      </select>
      {error && <p className="mt-1.5 text-sm font-semibold text-bad">{error}</p>}
    </div>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}
export function TextAreaField({ label, error, hint, id, ...rest }: TextAreaProps) {
  const fid = id ?? rest.name
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <textarea id={fid} aria-invalid={error ? true : undefined} className="input min-h-20 resize-y" {...rest} />
      {error ? (
        <p className="mt-1.5 text-sm font-semibold text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const statusTone: Record<OrderStatus, string> = {
  recibido: 'bg-sky-100 text-sky-800',
  pendiente_pago: 'bg-amber-100 text-amber-800',
  pago_confirmado: 'bg-emerald-100 text-emerald-800',
  en_preparacion: 'bg-brand-100 text-brand-800',
  en_camino: 'bg-violet-100 text-violet-800',
  entregado: 'bg-green-600 text-white',
  cancelado: 'bg-zinc-200 text-zinc-600',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${statusTone[status]}`}>{orderStatusLabel[status]}</span>
}

const payTone: Record<PaymentStatus, string> = {
  pendiente: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  pagado: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  rechazado: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  reintegrado: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`chip ${payTone[status]}`}>{paymentStatusLabel[status]}</span>
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">{icon}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function PageTitle({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back} className="mb-2 -ml-1 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Volver
        </Link>
      )}
      <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  )
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  label = 'Cantidad',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  label?: string
}) {
  const btn = size === 'sm' ? 'size-8' : 'size-11'
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-white" role="group" aria-label={label}>
      <button
        type="button"
        className={`${btn} grid place-items-center rounded-l-xl text-ink hover:bg-black/5 disabled:opacity-30`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Restar uno"
      >
        <Minus className="size-4" />
      </button>
      <span className={`min-w-9 text-center font-display font-bold ${size === 'sm' ? 'text-sm' : 'text-lg'}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${btn} grid place-items-center rounded-r-xl text-ink hover:bg-black/5 disabled:opacity-30`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Sumar uno"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const cls = {
    info: 'bg-sky-50 text-sky-900 ring-sky-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
    error: 'bg-red-50 text-red-800 ring-red-200',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  }[tone]
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${cls}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  )
}

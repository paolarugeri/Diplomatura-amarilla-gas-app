import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { AuthShell } from './AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'
import { friendlyError, supabase } from '../../lib/supabase'
import { validateEmail } from '../../lib/validation'
import { useToast } from '../../context/ToastContext'
import { canVisit, homeFor } from '../../lib/home'
import type { Role } from '../../lib/types'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = { email: validateEmail(email), password: password ? undefined : 'Ingresá tu contraseña.' }
    setErrors(next)
    setFormError('')
    if (next.email || next.password) return
    setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      setBusy(false)
      setFormError(friendlyError(error))
      return
    }
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', data.user.id).single()
    const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id)
    setBusy(false)
    toast('success', `¡Hola, ${profile?.full_name?.split(' ')[0] ?? ''}!`)
    const role = profile?.role as Role | undefined
    // Volver a la página anterior solo si ese perfil puede verla; si no, a su pantalla de inicio
    if (from && from !== '/ingresar' && from !== '/' && canVisit(from.split('?')[0], role)) navigate(from, { replace: true })
    else if (role === 'admin' || role === 'repartidor') navigate(homeFor(role), { replace: true })
    else if (!count) navigate('/domicilios/nuevo?primero=1', { replace: true })
    else navigate('/catalogo', { replace: true })
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Ingresá con tu correo y contraseña para hacer tu pedido."
      footer={
        <>
          ¿Todavía no tenés cuenta?{' '}
          <Link to="/registro" state={location.state} className="font-bold text-ink underline underline-offset-4">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tunombre@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          icon={<Mail className="size-5" />}
        />
        <Field
          label="Contraseña"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          icon={<Lock className="size-5" />}
          right={
            <button type="button" className="grid size-9 place-items-center text-muted" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />
        <div className="text-right">
          <Link to="/recuperar" className="text-sm font-semibold text-brand-800 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <button className="btn-primary w-full py-3.5" disabled={busy}>
          {busy ? <Spinner className="size-5 text-ink" /> : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  )
}

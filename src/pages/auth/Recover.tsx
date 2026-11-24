import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, MailCheck } from 'lucide-react'
import { AuthShell } from './AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'
import { friendlyError, supabase } from '../../lib/supabase'
import { validateEmail, validatePassword } from '../../lib/validation'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validateEmail(email)
    setError(err)
    if (err) return
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    setBusy(false)
    if (error) setFormError(friendlyError(error))
    else setSent(true)
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para crear una contraseña nueva."
      footer={
        <Link to="/ingresar" className="font-bold text-ink underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">
            <MailCheck className="size-8" />
          </div>
          <p className="mt-4 text-[15px]">
            Si <b>{email}</b> está registrado, vas a recibir un correo con el enlace para restablecer tu contraseña. Revisá
            también la carpeta de spam.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="Correo electrónico" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} icon={<Mail className="size-5" />} />
          <button className="btn-primary w-full py-3.5" disabled={busy}>
            {busy ? <Spinner className="size-5 text-ink" /> : 'Enviar enlace'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500)
    return () => clearTimeout(t)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = { pw: validatePassword(pw), confirm: pw !== confirm ? 'Las contraseñas no coinciden.' : undefined }
    setErrors(next)
    if (next.pw || next.confirm) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setFormError(friendlyError(error))
    toast('success', 'Tu contraseña se actualizó correctamente.')
    navigate('/catalogo', { replace: true })
  }

  if (!session && (loading || !waited)) {
    return (
      <AuthShell title="Restablecer contraseña">
        <div className="flex justify-center py-8">
          <Spinner className="size-8" />
        </div>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell title="Enlace vencido">
        <Alert tone="warn">El enlace de recuperación no es válido o ya venció. Pedí uno nuevo.</Alert>
        <Link to="/recuperar" className="btn-primary mt-6 w-full">
          Pedir un enlace nuevo
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elegí una contraseña segura que no uses en otros sitios.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Nueva contraseña" name="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} icon={<Lock className="size-5" />} />
        <Field label="Repetí la contraseña" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} icon={<Lock className="size-5" />} />
        <button className="btn-primary w-full py-3.5" disabled={busy}>
          {busy ? <Spinner className="size-5 text-ink" /> : 'Guardar contraseña'}
        </button>
      </form>
    </AuthShell>
  )
}

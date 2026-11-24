import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, MailCheck, Phone, User } from 'lucide-react'
import { AuthShell } from './AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'
import { friendlyError, supabase } from '../../lib/supabase'
import { validateEmail, validateName, validatePassword, validatePhone, type Errors } from '../../lib/validation'
import { useToast } from '../../context/ToastContext'

interface Form {
  full_name: string
  email: string
  phone: string
  password: string
  confirm: string
  terms: string
}

export default function Register() {
  const navigate = useNavigate()
  const toast = useToast()
  const [f, setF] = useState<Form>({ full_name: '', email: '', phone: '', password: '', confirm: '', terms: '' })
  const [accepted, setAccepted] = useState(false)
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<Errors<Form>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  function validate(): Errors<Form> {
    return {
      full_name: validateName(f.full_name),
      email: validateEmail(f.email),
      phone: validatePhone(f.phone),
      password: validatePassword(f.password),
      confirm: f.confirm !== f.password ? 'Las contraseñas no coinciden.' : undefined,
      terms: accepted ? undefined : 'Tenés que aceptar el uso de tus datos para gestionar pedidos.',
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    setFormError('')
    if (Object.values(errs).some(Boolean)) return
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.password,
      options: {
        data: { full_name: f.full_name.trim().replace(/\s+/g, ' '), phone: f.phone.trim() },
        emailRedirectTo: `${window.location.origin}/domicilios/nuevo?primero=1`,
      },
    })
    setBusy(false)
    if (error) {
      setFormError(friendlyError(error))
      return
    }
    // Supabase devuelve un usuario sin identidades si el correo ya estaba registrado
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setFormError('Ya existe una cuenta con ese correo. Probá iniciar sesión.')
      return
    }
    if (data.session) {
      toast('success', '¡Cuenta creada! Ahora cargá tu domicilio de entrega.')
      navigate('/domicilios/nuevo?primero=1', { replace: true })
    } else {
      setPendingEmail(f.email.trim())
    }
  }

  if (pendingEmail) {
    return (
      <AuthShell title="Confirmá tu correo">
        <div className="flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">
            <MailCheck className="size-8" />
          </div>
          <p className="mt-4 text-[15px]">
            Te enviamos un enlace a <b>{pendingEmail}</b>. Abrilo para activar tu cuenta y continuar con tu pedido.
          </p>
          <Link to="/ingresar" className="btn-primary mt-6 w-full">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Registrate una sola vez y pedí tu gas cuando lo necesites."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/ingresar" className="font-bold text-ink underline underline-offset-4">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Nombre y apellido" name="full_name" autoComplete="name" placeholder="Ej. Lucía Gómez" value={f.full_name} onChange={set('full_name')} error={errors.full_name} icon={<User className="size-5" />} />
        <Field label="Correo electrónico" name="email" type="email" inputMode="email" autoComplete="email" placeholder="tunombre@correo.com" value={f.email} onChange={set('email')} error={errors.email} icon={<Mail className="size-5" />} />
        <Field label="Teléfono" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Ej. 11 5555-1234" value={f.phone} onChange={set('phone')} error={errors.phone} hint="Lo usamos solo para coordinar la entrega." icon={<Phone className="size-5" />} />
        <Field
          label="Contraseña"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres, letras y números"
          value={f.password}
          onChange={set('password')}
          error={errors.password}
          icon={<Lock className="size-5" />}
          right={
            <button type="button" className="grid size-9 place-items-center text-muted" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />
        <Field label="Repetí la contraseña" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} icon={<Lock className="size-5" />} />
        <div>
          <label className="flex items-start gap-3 text-sm text-ink-2">
            <input type="checkbox" className="mt-0.5 size-5 accent-brand-700" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>Acepto que Amarilla Gas use mis datos únicamente para gestionar mis pedidos y entregas.</span>
          </label>
          {errors.terms && <p className="mt-1.5 text-sm font-semibold text-bad">{errors.terms}</p>}
        </div>
        <button className="btn-primary w-full py-3.5" disabled={busy}>
          {busy ? <Spinner className="size-5 text-ink" /> : 'Crear mi cuenta'}
        </button>
      </form>
    </AuthShell>
  )
}

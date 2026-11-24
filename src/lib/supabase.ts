import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Convierte errores de Supabase/Postgres en mensajes claros para el cliente. */
export function friendlyError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Ocurrió un error inesperado.'

  const map: [RegExp, string][] = [
    [/invalid login credentials/i, 'El correo o la contraseña no son correctos.'],
    [/email not confirmed/i, 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.'],
    [/user already registered|already been registered/i, 'Ya existe una cuenta con ese correo. Probá iniciar sesión.'],
    [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit|too many requests|security purposes/i, 'Hiciste demasiados intentos seguidos. Esperá unos segundos y volvé a probar.'],
    [/failed to fetch|network/i, 'No pudimos conectarnos. Revisá tu conexión a internet.'],
    [/jwt expired/i, 'Tu sesión expiró. Volvé a iniciar sesión.'],
    [/new password should be different/i, 'La nueva contraseña debe ser distinta a la anterior.'],
    [/violates check constraint "addresses_postal_code_check"/i, 'El código postal no es válido.'],
    [/violates check constraint "profiles_phone_check"/i, 'El teléfono no es válido.'],
    [/violates check constraint/i, 'Algún dato no tiene el formato correcto.'],
    [/permission denied|row-level security/i, 'No tenés permisos para realizar esta acción.'],
  ]
  for (const [re, msg] of map) if (re.test(raw)) return msg
  return raw
}

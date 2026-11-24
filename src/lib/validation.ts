export type Errors<T> = Partial<Record<keyof T, string>>

export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const phoneRe = /^[0-9 +()-]{8,20}$/
export const postalRe = /^([A-Za-z][0-9]{4}[A-Za-z]{3}|[0-9]{4})$/
export const numberRe = /^([0-9]{1,6}[A-Za-z]?|S\/?N)$/i

export function validatePassword(pw: string): string | undefined {
  if (pw.length < 8) return 'Usá al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Combiná letras y números.'
  return undefined
}

export function validateEmail(v: string): string | undefined {
  if (!v.trim()) return 'Ingresá tu correo electrónico.'
  if (!emailRe.test(v.trim())) return 'El correo no tiene un formato válido.'
  return undefined
}

export function validatePhone(v: string): string | undefined {
  const digits = v.replace(/\D/g, '')
  if (!v.trim()) return 'Ingresá tu teléfono.'
  if (!phoneRe.test(v.trim()) || digits.length < 8) return 'Ingresá un teléfono válido, con código de área (ej. 11 5555-1234).'
  return undefined
}

export function validateName(v: string): string | undefined {
  const t = v.trim()
  if (!t) return 'Ingresá tu nombre y apellido.'
  if (t.length < 3 || !t.includes(' ')) return 'Ingresá nombre y apellido.'
  if (!/^[\p{L} .'-]+$/u.test(t)) return 'El nombre solo puede tener letras.'
  return undefined
}

export interface AddressInput {
  label: string
  street: string
  number: string
  apartment: string
  city: string
  province: string
  postal_code: string
  reference: string
}

export function validateAddress(a: AddressInput): Errors<AddressInput> {
  const e: Errors<AddressInput> = {}
  if (!a.label.trim()) e.label = 'Poné un nombre, por ejemplo "Casa".'
  if (a.street.trim().length < 2) e.street = 'Ingresá la calle.'
  if (!numberRe.test(a.number.trim())) e.number = 'Ingresá la altura (solo números, o S/N).'
  if (a.city.trim().length < 2) e.city = 'Ingresá la localidad.'
  if (a.province.trim().length < 2) e.province = 'Elegí la provincia.'
  if (!postalRe.test(a.postal_code.trim())) e.postal_code = 'Código postal de 4 dígitos (ej. 1884) o CPA (ej. B1884ABC).'
  if (a.reference.length > 250) e.reference = 'Máximo 250 caracteres.'
  return e
}

export const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

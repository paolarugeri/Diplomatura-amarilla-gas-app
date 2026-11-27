import type { Role } from './types'

/** Pantalla de inicio de cada perfil. */
export const homeFor = (role: Role | null | undefined) => (role === 'admin' ? '/admin' : role === 'repartidor' ? '/reparto' : '/catalogo')

/** ¿Este perfil puede entrar a esta ruta? Evita mandar a un cliente a una sección del personal. */
export function canVisit(path: string, role: Role | null | undefined) {
  if (path === '/admin' || path.startsWith('/admin/')) return role === 'admin'
  if (path === '/reparto' || path.startsWith('/reparto/')) return role === 'repartidor'
  return true
}

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'
import type { Role } from '../lib/types'
import { homeFor } from '../lib/home'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/ingresar" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

/**
 * Oculta una sección a quien no tiene el perfil indicado. Es solo una ayuda de navegación:
 * la protección real está en la base (RLS y funciones con verificación de rol).
 */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading || (session && !profile)) return <PageLoader />
  if (!session) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
  // Un usuario con otro perfil (por ejemplo, un cliente que llega a /admin) va a su pantalla de inicio
  if (profile && profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />
  return <>{children}</>
}

export const RequireAdmin = ({ children }: { children: ReactNode }) => <RequireRole role="admin">{children}</RequireRole>
export const RequireDriver = ({ children }: { children: ReactNode }) => <RequireRole role="repartidor">{children}</RequireRole>

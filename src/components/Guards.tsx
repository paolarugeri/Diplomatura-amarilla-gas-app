import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { EmptyState, PageLoader } from './ui'
import type { Role } from '../lib/types'

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
  if (profile?.role !== role)
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState
          icon={<ShieldAlert className="size-8" />}
          title="Acceso restringido"
          text="Esta sección es exclusiva para el personal autorizado de Amarilla Gas."
        />
      </div>
    )
  return <>{children}</>
}

export const RequireAdmin = ({ children }: { children: ReactNode }) => <RequireRole role="admin">{children}</RequireRole>
export const RequireDriver = ({ children }: { children: ReactNode }) => <RequireRole role="repartidor">{children}</RequireRole>

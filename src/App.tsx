import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireAuth, RequireDriver } from './components/Guards'
import { PageLoader } from './components/ui'
import { isConfigured } from './lib/supabase'
import Welcome from './pages/Welcome'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { ForgotPassword, ResetPassword } from './pages/auth/Recover'
import Catalog from './pages/Catalog'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import { MyOrderDetail, MyOrders } from './pages/MyOrders'
import Profile from './pages/Profile'
import AddressEdit from './pages/AddressEdit'
import PaymentResult from './pages/PaymentResult'

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminDeliveries = lazy(() => import('./pages/admin/AdminDeliveries'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then((m) => ({ default: m.AdminCustomers })))
const AdminCustomerDetail = lazy(() => import('./pages/admin/AdminCustomers').then((m) => ({ default: m.AdminCustomerDetail })))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminPermissions = lazy(() => import('./pages/admin/AdminPermissions'))
const DriverDeliveries = lazy(() => import('./pages/DriverDeliveries'))

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-extrabold">Falta configurar la conexión</h1>
      <p className="mt-2 text-sm text-muted">
        Creá el archivo <code>.env.local</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (ver docs/CONFIGURACION.md).
      </p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  const auth = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/ingresar" element={<Login />} />
                <Route path="/registro" element={<Register />} />
                <Route path="/recuperar" element={<ForgotPassword />} />
                <Route path="/restablecer" element={<ResetPassword />} />
                <Route element={<Layout />}>
                  <Route path="/catalogo" element={<Catalog />} />
                  <Route path="/carrito" element={<Cart />} />
                  <Route path="/confirmar" element={auth(<Checkout />)} />
                  <Route path="/pedido/:id/confirmado" element={auth(<OrderConfirmation />)} />
                  <Route path="/pago/resultado" element={auth(<PaymentResult />)} />
                  <Route path="/mis-pedidos" element={auth(<MyOrders />)} />
                  <Route path="/mis-pedidos/:id" element={auth(<MyOrderDetail />)} />
                  <Route path="/perfil" element={auth(<Profile />)} />
                  <Route path="/domicilios/nuevo" element={auth(<AddressEdit />)} />
                  <Route path="/domicilios/:id" element={auth(<AddressEdit />)} />
                  <Route
                    path="/reparto"
                    element={
                      <RequireDriver>
                        <DriverDeliveries />
                      </RequireDriver>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="pedidos" element={<AdminOrders />} />
                    <Route path="entregas" element={<AdminDeliveries />} />
                    <Route path="productos" element={<AdminProducts />} />
                    <Route path="clientes" element={<AdminCustomers />} />
                    <Route path="clientes/:id" element={<AdminCustomerDetail />} />
                    <Route path="permisos" element={<AdminPermissions />} />
                    <Route path="configuracion" element={<AdminSettings />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

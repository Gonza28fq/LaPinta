import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Login from './components/auth/Login'
import './styles/themes.css'

const Dashboard       = lazy(() => import('./pages/Dashboard'))
const DashboardWaiter = lazy(() => import('./pages/DashboardWaiter'))
const Mesas           = lazy(() => import('./pages/Mesas'))
const Pedidos         = lazy(() => import('./pages/Pedidos'))
const Productos       = lazy(() => import('./pages/Productos'))
const Caja            = lazy(() => import('./pages/Caja'))
const Empleados       = lazy(() => import('./pages/Empleados'))
const Metricas        = lazy(() => import('./pages/Metricas'))
const Clientes        = lazy(() => import('./pages/Clientes'))
const Historial       = lazy(() => import('./pages/Historial'))
const Cocina          = lazy(() => import('./pages/Cocina'))
const Barra           = lazy(() => import('./pages/Barra'))

const Loading = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
    fontSize: 14,
  }}>
    Cargando...
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: '13px',
              },
              success: { duration: 3000 },
              error:   { duration: 5000 },
            }}
          />
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* Pública */}
              <Route path="/login" element={<Login />} />

              {/* Dueño + Encargado */}
              <Route path="/dashboard" element={
                <PrivateRoute roles={['owner','manager']}>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/metricas" element={
                <PrivateRoute roles={['owner']}>
                  <Metricas />
                </PrivateRoute>
              } />
              <Route path="/empleados" element={
                <PrivateRoute roles={['owner','manager']}>
                  <Empleados />
                </PrivateRoute>
              } />
              <Route path="/productos" element={
                <PrivateRoute roles={['owner','manager']}>
                  <Productos />
                </PrivateRoute>
              } />

              {/* Dueño + Encargado + Cajero */}
              <Route path="/historial" element={
                <PrivateRoute roles={['owner','manager','cashier']}>
                  <Historial />
                </PrivateRoute>
              } />
              <Route path="/clientes" element={
                <PrivateRoute roles={['owner','manager','cashier']}>
                  <Clientes />
                </PrivateRoute>
              } />
              <Route path="/caja" element={
                <PrivateRoute roles={['owner','manager','cashier']}>
                  <Caja />
                </PrivateRoute>
              } />

              {/* Todos los roles operativos */}
              <Route path="/mesas" element={
                <PrivateRoute roles={['owner','manager','waiter']}>
                  <Mesas />
                </PrivateRoute>
              } />
              <Route path="/pedidos" element={
                <PrivateRoute roles={['owner','manager','waiter','cashier']}>
                  <Pedidos />
                </PrivateRoute>
              } />

              {/* Mozo — su propio dashboard */}
              <Route path="/inicio" element={
                <PrivateRoute roles={['waiter']}>
                  <DashboardWaiter />
                </PrivateRoute>
              } />

              {/* Cocina */}
              <Route path="/cocina" element={
                <PrivateRoute roles={['owner','manager','kitchen']}>
                  <Cocina />
                </PrivateRoute>
              } />
              <Route path="/barra" element={
                <PrivateRoute roles={['owner','manager','bartender']}>
                  <Barra />
                </PrivateRoute>
              } />

              {/* Raíz → login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Ruta no encontrada → login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

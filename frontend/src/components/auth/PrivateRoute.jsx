import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
        fontSize: 14
      }}>
        Cargando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    // Redirigir según el rol del usuario
    if (user.role === 'waiter') return <Navigate to="/mesas" replace />
    if (user.role === 'cashier') return <Navigate to="/caja" replace />
    if (user.role === 'bartender') return <Navigate to="/barra" replace />
    if (user.role === 'kitchen') return <Navigate to="/cocina" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}

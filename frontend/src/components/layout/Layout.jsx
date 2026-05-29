import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import NotificationPanel from './NotificationPanel'
import ThemeToggle from './ThemeToggle'
import './Layout.css'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'D', roles: ['owner','manager'] },
  { path: '/inicio', label: 'Inicio', icon: 'I', roles: ['waiter'] },
  { path: '/mesas', label: 'Mesas', icon: 'M', roles: ['owner','manager','waiter'] },
  { path: '/pedidos', label: 'Pedidos', icon: 'P', roles: ['owner','manager','waiter','cashier'] },
  { path: '/caja', label: 'Caja', icon: 'C', roles: ['owner','manager','cashier'] },
  { path: '/productos', label: 'Carta', icon: 'A', roles: ['owner','manager'] },
  { path: '/clientes', label: 'Clientes', icon: 'CL', roles: ['owner','manager','cashier'] },
  { path: '/empleados', label: 'Empleados', icon: 'E', roles: ['owner','manager'] },
  { path: '/metricas', label: 'Metricas', icon: 'MT', roles: ['owner'] },
  { path: '/historial', label: 'Historial', icon: 'H', roles: ['owner','manager','cashier'] },
  { path: '/cocina', label: 'Cocina', icon: 'K', roles: ['owner','manager'] },
  { path: '/barra', label: 'Barra', icon: 'B', roles: ['owner','manager','bartender'] },
]

const ROLE_LABEL = {
  owner: 'Dueno',
  manager: 'Encargado',
  waiter: 'Mozo',
  cashier: 'Cajero',
  kitchen: 'Cocina',
  bartender: 'Bartender',
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { unreadCount, connected } = useSocket()
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user?.role))

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo-img" src="/assets/lapinta-logo.jpg" alt="La Pinta" />
          <div>
            <div className="sidebar-brand-name">La Pinta</div>
            <div className="sidebar-brand-sub">Burger Club</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.avatar_initials || 'U'}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{ROLE_LABEL[user?.role]}</div>
            </div>
          </div>
          <ThemeToggle />
          <button className="btn btn-ghost sidebar-logout" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>Menu</button>
          <div className="topbar-right">
            <div className={`connection-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Conectado' : 'Sin conexion'} />
            <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
              O
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
          </div>
        </header>

        {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}

        <main className="layout-content">{children}</main>
      </div>
    </div>
  )
}

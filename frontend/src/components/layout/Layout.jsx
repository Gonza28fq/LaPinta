import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import NotificationPanel from './NotificationPanel'
import ThemeToggle from './ThemeToggle'
import {
  LayoutDashboard, Home, LayoutGrid, ClipboardList, Wallet,
  UtensilsCrossed, Users, UserCog, BarChart3, History,
  ChefHat, Martini, Menu as MenuIcon, Bell,
} from 'lucide-react'
import './Layout.css'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner','manager'] },
  { path: '/inicio', label: 'Inicio', icon: Home, roles: ['waiter'] },
  { path: '/mesas', label: 'Mesas', icon: LayoutGrid, roles: ['owner','manager','waiter'] },
  { path: '/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['owner','manager','waiter','cashier'] },
  { path: '/caja', label: 'Caja', icon: Wallet, roles: ['owner','manager','cashier'] },
  { path: '/productos', label: 'Carta', icon: UtensilsCrossed, roles: ['owner','manager'] },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['owner','manager','cashier'] },
  { path: '/empleados', label: 'Empleados', icon: UserCog, roles: ['owner','manager'] },
  { path: '/metricas', label: 'Metricas', icon: BarChart3, roles: ['owner'] },
  { path: '/historial', label: 'Historial', icon: History, roles: ['owner','manager','cashier'] },
  { path: '/cocina', label: 'Cocina', icon: ChefHat, roles: ['owner','manager'] },
  { path: '/barra', label: 'Barra', icon: Martini, roles: ['owner','manager','bartender'] },
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
          {visibleNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-icon"><Icon size={20} strokeWidth={2} /></span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
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
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon size={22} />
          </button>
          <div className="topbar-right">
            <div className={`connection-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Conectado' : 'Sin conexion'} />
            <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell size={20} />
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
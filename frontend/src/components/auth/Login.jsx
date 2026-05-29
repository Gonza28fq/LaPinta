import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import './Login.css'

const THEMES = [
  { id: 'slate_blue',  label: 'Azul pizarra', preview: '#1a2535', accent: '#C8A96A' },
  { id: 'green_black', label: 'Verde y negro', preview: '#080d08', accent: '#4daa4d' },
  { id: 'dark_bw',     label: 'Blanco y negro', preview: '#0a0a0a', accent: '#ffffff' },
]

const ROLE_LABELS = {
  owner:   { label: 'Dueño', icon: '◆' },
  manager: { label: 'Encargado', icon: '◈' },
  waiter:  { label: 'Mozo', icon: '◇' },
  cashier: { label: 'Cajero', icon: '◉' },
  bartender: { label: 'Bartender', icon: 'B' },
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewTheme, setPreviewTheme] = useState(null)

  const handleThemePreview = (themeId) => {
    setPreviewTheme(themeId)
    document.documentElement.setAttribute('data-theme', themeId)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Completá todos los campos')
      return
    }
    setLoading(true)
    try {
      const data = await login(email, password)
      toast.success(data.message)
      const role = data.user.role
      if (role === 'owner' || role === 'manager') navigate('/dashboard')
      else if (role === 'waiter') navigate('/mesas')
      else if (role === 'cashier') navigate('/caja')
      else if (role === 'bartender') navigate('/barra')
      else if (role === 'kitchen') navigate('/cocina')
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <img className="login-logo-img" src="/assets/lapinta-logo.jpg" alt="La Pinta" />
          <h1 className="login-title">La Pinta</h1>
          <p className="login-subtitle">Burger Club · Sistema de gestión</p>
        </div>

        <div className="login-theme-section">
          <p className="login-theme-label">Elegí tu tema</p>
          <div className="login-theme-row">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`login-theme-btn ${previewTheme === t.id ? 'active' : ''}`}
                style={{ '--preview-bg': t.preview, '--preview-accent': t.accent }}
                onClick={() => handleThemePreview(t.id)}
                type="button"
              >
                <span className="theme-dot" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-form-title">Ingresar</h2>

          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@lapinta.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar al sistema'}
          </button>

          <div className="login-roles-info">
            {Object.entries(ROLE_LABELS).map(([role, { label, icon }]) => (
              <div key={role} className="login-role-chip">
                <span className="role-icon">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </form>

        <div className="login-footer">
          <span className="login-status-dot" />
          <span>Sistema operativo · v1.0</span>
        </div>
      </div>
    </div>
  )
}

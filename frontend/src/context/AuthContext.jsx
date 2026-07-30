import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api'
axios.defaults.baseURL = API
const AuthContext = createContext(null)
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const applyTheme = (theme) => document.documentElement.setAttribute('data-theme', theme || 'slate_blue')
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) { setLoading(false); return }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    try {
      const { data } = await axios.get('/auth/me')
      setUser(data.user); applyTheme(data.user.theme)
    } catch {
      localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadUser() }, [loadUser])
  useEffect(() => {
    const id = axios.interceptors.response.use(r => r, async err => {
      const orig = err.config
      if (err.response?.status === 401 && !orig._retry && !orig.url?.includes('/auth/login') && !orig.url?.includes('/auth/refresh'))  {
        orig._retry = true
        try {
          const rt = localStorage.getItem('refreshToken')
          const { data } = await axios.post('/auth/refresh', { refreshToken: rt })
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
          orig.headers['Authorization'] = `Bearer ${data.accessToken}`
          return axios(orig)
        } catch { logout() }
      }
      return Promise.reject(err)
    })
    return () => axios.interceptors.response.eject(id)
  }, [])
  const login = async (email, password) => {
    const { data } = await axios.post('/auth/login', { email, password })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
    setUser(data.user); applyTheme(data.user.theme)
    return data
  }
  const logout = async () => {
    try { await axios.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }) } catch {}
    localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken')
    delete axios.defaults.headers.common['Authorization']
    setUser(null); applyTheme('slate_blue')
  }
  const changeTheme = async (theme) => {
    await axios.patch('/auth/theme', { theme })
    setUser(u => ({ ...u, theme })); applyTheme(theme)
  }
  const isOwner   = user?.role === 'owner'
  const isManager = user?.role === 'manager' || isOwner
  const isWaiter  = user?.role === 'waiter'
  const isCashier = user?.role === 'cashier' || isManager
  const isBartender = user?.role === 'bartender'
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changeTheme, isOwner, isManager, isWaiter, isCashier, isBartender, canTakeOrders: isWaiter || isManager, canConfirmOrders: isManager || isCashier }}>
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth = () => useContext(AuthContext)

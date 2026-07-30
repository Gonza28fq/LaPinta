import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { staffAPI, auditoriaAPI, usersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'
import './Empleados.css'

const ROLES = {
  owner:   'Dueño',
  manager: 'Encargado',
  waiter:  'Mozo',
  cashier: 'Cajero',
  kitchen: 'Cocina',
  bartender: 'Bartender',
}
const ROLE_COLORS = {
  owner:   'var(--accent)',
  manager: 'var(--order-confirmed)',
  waiter:  'var(--order-ready)',
  cashier: 'var(--warning)',
  kitchen: 'var(--order-kitchen)',
  bartender: 'var(--info)',
}
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const METHOD_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', qr:'QR' }

// ---- Modal nuevo empleado ----
function NuevoUsuarioModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'waiter', hourly_rate:'' })
  const [saving, setSaving] = useState(false)
  const h = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('Completá todos los campos'); return }
    setSaving(true)
    try {
      const data = await api.post('/users', form)
      onSave(data); toast.success('Empleado creado'); onClose()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al crear empleado') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="emp-modal">
        <div className="modal-header">
          <h2 className="modal-title">Nuevo empleado</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="emp-modal-body">
          <div className="form-row"><label>Nombre completo</label>
            <input value={form.name} onChange={e => h('name', e.target.value)} placeholder="Juan Pérez" />
          </div>
          <div className="form-row"><label>Email</label>
            <input type="email" value={form.email} onChange={e => h('email', e.target.value)} placeholder="juan@lapinta.com" />
          </div>
          <div className="form-row"><label>Contraseña inicial</label>
            <input type="password" value={form.password} onChange={e => h('password', e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-grid-2">
            <div className="form-row"><label>Rol</label>
              <select value={form.role} onChange={e => h('role', e.target.value)}>
                <option value="manager">Encargado</option>
                <option value="waiter">Mozo</option>
                <option value="cashier">Cajero</option>
                <option value="kitchen">Cocina</option>
                <option value="bartender">Bartender</option>
              </select>
            </div>
            <div className="form-row"><label>Tarifa/hora ($)</label>
              <input type="number" value={form.hourly_rate} onChange={e => h('hourly_rate', e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando...' : 'Crear empleado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Modal pago mensual ----
function PagoModal({ user, month, year, onClose, onSave }) {
  const [form, setForm] = useState({ base_salary:'', bonuses:'', deductions:'', notes:'' })
  const [hours, setHours] = useState(null)
  const [saving, setSaving] = useState(false)
  const h = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    staffAPI.getShifts(user.id, month, year).then(shifts => {
      const t = shifts.reduce((s, sh) => s + parseFloat(sh.hours_worked || 0), 0)
      setHours(t.toFixed(1))
      if (user.hourly_rate) h('base_salary', (t * user.hourly_rate).toFixed(0))
    }).catch(() => {})
  }, [])

  const total = (parseFloat(form.base_salary)||0) + (parseFloat(form.bonuses)||0) - (parseFloat(form.deductions)||0)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const data = await staffAPI.createPayment({ user_id:user.id, period_month:month, period_year:year, ...form })
      onSave(data); toast.success('Pago registrado'); onClose()
    } catch { toast.error('Error al registrar pago') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="emp-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar pago</h2>
            <p className="modal-subtitle">{user.name} · {MONTHS[month-1]} {year}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="emp-modal-body">
          {hours !== null && (
            <div className="hours-preview">
              ⏱ Horas trabajadas: <strong>{hours}hs</strong>
              {user.hourly_rate && ` · Tarifa: $${Number(user.hourly_rate).toLocaleString('es-AR')}/h`}
            </div>
          )}
          <div className="form-row"><label>Sueldo base ($)</label>
            <input type="number" value={form.base_salary} onChange={e => h('base_salary', e.target.value)} placeholder="0" />
          </div>
          <div className="form-grid-2">
            <div className="form-row"><label>Bonificaciones ($)</label>
              <input type="number" value={form.bonuses} onChange={e => h('bonuses', e.target.value)} placeholder="0" />
            </div>
            <div className="form-row"><label>Descuentos ($)</label>
              <input type="number" value={form.deductions} onChange={e => h('deductions', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-row"><label>Notas</label>
            <input value={form.notes} onChange={e => h('notes', e.target.value)} placeholder="Observaciones..." />
          </div>
          <div className="pago-total">
            <span>Total a pagar</span>
            <span>${total.toLocaleString('es-AR')}</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Modal cambiar contraseña ----
function PasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    setSaving(true)
    try {
      await api.patch(`/users/${user.id}/password`, { password })
      toast.success('Contraseña actualizada')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar contraseña')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="emp-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Cambiar contraseña</h2>
            <p className="modal-subtitle">{user.name}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="emp-modal-body">
          <div className="form-row"><label>Nueva contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div className="form-row"><label>Confirmar contraseña</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetir contraseña" autoComplete="new-password" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Modal auditoría ----
function AuditoriaModal({ user, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  const load = async () => {
    setLoading(true)
    try { setData(await auditoriaAPI.get(user.id, { from, to })) }
    catch { toast.error('Error al cargar auditoría') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [from, to])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auditoria-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Auditoría — {user.name}</h2>
            <p className="modal-subtitle">{ROLES[user.role]}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Filtro de fechas */}
        <div className="aud-date-filter">
          <div className="form-row" style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <label style={{whiteSpace:'nowrap'}}>Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{width:'auto'}} />
          </div>
          <div className="form-row" style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <label style={{whiteSpace:'nowrap'}}>Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{width:'auto'}} />
          </div>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={() => { setFrom(today); setTo(today) }}>Hoy</button>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={() => {
            const d = new Date(); d.setDate(1)
            setFrom(d.toISOString().split('T')[0]); setTo(today)
          }}>Este mes</button>
        </div>

        {/* Tabs */}
        <div className="aud-tabs">
          {['resumen','pedidos','cobros','turnos'].map(t => (
            <button key={t} className={'aud-tab' + (tab===t?' active':'')} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        <div className="aud-body">
          {loading ? (
            <div className="aud-loading">Cargando auditoría...</div>
          ) : !data ? null : tab === 'resumen' ? (
            <div className="aud-resumen">
              <div className="aud-metrics">
                {[
                  { label:'Pedidos tomados',   val: data.metrics.totalOrders,     show: ['waiter','manager','owner'].includes(user.role) },
                  { label:'Pedidos cobrados',  val: data.metrics.billedOrders,    show: ['waiter','manager','owner'].includes(user.role) },
                  { label:'Cancelados',        val: data.metrics.cancelledOrders, show: ['waiter','manager','owner'].includes(user.role), warn: data.metrics.cancelledOrders > 0 },
                  { label:'Ventas generadas',  val: `$${data.metrics.totalSales.toLocaleString('es-AR')}`, show: ['waiter','manager','owner'].includes(user.role), accent:true },
                  { label:'Pedidos confirmados',val: data.metrics.totalConfirmed,  show: ['cashier','manager','owner'].includes(user.role) },
                  { label:'Total cobrado',     val: `$${data.metrics.totalCobrado.toLocaleString('es-AR')}`, show: ['cashier','manager','owner'].includes(user.role), accent:true },
                  { label:'Propinas recibidas',val: `$${data.metrics.totalTips.toLocaleString('es-AR')}`, show: ['cashier','manager','owner'].includes(user.role) },
                  { label:'Horas trabajadas',  val: `${data.metrics.totalHours}h`, show: true },
                  { label:'Turnos',            val: data.metrics.shiftsCount,      show: true },
                ].filter(m => m.show).map((m, i) => (
                  <div key={i} className="aud-metric-card">
                    <div className="aud-metric-label">{m.label}</div>
                    <div className={'aud-metric-val' + (m.accent?' accent':'') + (m.warn?' warn':'')}>
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>

              {data.payments.length > 0 && (
                <div className="aud-pagos-hist">
                  <div className="aud-sub-title">Pagos registrados</div>
                  {data.payments.map((p, i) => (
                    <div key={i} className="aud-pago-row">
                      <span>{MONTHS[p.period_month-1]} {p.period_year}</span>
                      <span className="aud-pago-total">${Number(p.total_pay).toLocaleString('es-AR')}</span>
                      <span className={'aud-pago-status' + (p.paid?' paid':'')}>{p.paid?'Pagado':'Pendiente'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'pedidos' ? (
            <div className="aud-table-wrap">
              {data.orders.length === 0
                ? <div className="aud-empty">Sin pedidos en el período</div>
                : <table className="aud-table">
                    <thead><tr><th>Hora</th><th>Mesa</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead>
                    <tbody>
                      {data.orders.map(o => (
                        <tr key={o.id}>
                          <td className="aud-td-muted">{new Date(o.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</td>
                          <td>Mesa {o.table_number||'—'}</td>
                          <td>{o.customer_name||'—'}</td>
                          <td><span className={'aud-status-dot st-'+o.status}/>{o.status}</td>
                          <td className="aud-td-accent">${Number(o.total).toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
            </div>
          ) : tab === 'cobros' ? (
            <div className="aud-table-wrap">
              {data.cobros.length === 0
                ? <div className="aud-empty">Sin cobros en el período</div>
                : <table className="aud-table">
                    <thead><tr><th>Hora</th><th>Mesa</th><th>Método</th><th>Monto</th><th>Propina</th></tr></thead>
                    <tbody>
                      {data.cobros.map(c => (
                        <tr key={c.id}>
                          <td className="aud-td-muted">{new Date(c.paid_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</td>
                          <td>Mesa {c.table_number||'—'}</td>
                          <td>{METHOD_LABEL[c.method]||c.method}</td>
                          <td className="aud-td-accent">${Number(c.amount).toLocaleString('es-AR')}</td>
                          <td>{c.tip>0?`$${Number(c.tip).toLocaleString('es-AR')}`:'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
            </div>
          ) : (
            <div className="aud-table-wrap">
              {data.shifts.length === 0
                ? <div className="aud-empty">Sin turnos en el período</div>
                : <table className="aud-table">
                    <thead><tr><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead>
                    <tbody>
                      {data.shifts.map(s => (
                        <tr key={s.id}>
                          <td>{new Date(s.clock_in).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                          <td>{s.clock_out?new Date(s.clock_out).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'En turno'}</td>
                          <td className="aud-td-accent">{s.hours_worked?`${parseFloat(s.hours_worked).toFixed(1)}h`:'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Página principal ----
export default function Empleados() {
  const { isOwner } = useAuth()
  const [users, setUsers]     = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('equipo')
  const [showNew, setShowNew] = useState(false)
  const [pagoUser, setPagoUser]       = useState(null)
  const [auditoriaUser, setAuditoriaUser] = useState(null)
  const [passwordUser, setPasswordUser] = useState(null)
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [u, p] = await Promise.all([
          usersAPI.getAll(),
          staffAPI.getPayments(month, year),
        ])
        setUsers(u); setPayments(p)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  const handleToggle = async (user) => {
    try {
      await usersAPI.update(user.id, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'Usuario desactivado' : 'Usuario activado')
    } catch { toast.error('Error al actualizar') }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`¿Eliminar a ${user.name}?`)) return
    try {
      const res = await usersAPI.delete(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      toast.success(res.message || 'Empleado eliminado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  return (
    <Layout>
      <div className="emp-page">
        <div className="emp-header">
          <div>
            <h1 className="emp-title">Empleados</h1>
            <p className="emp-subtitle">{users.filter(u => u.is_active).length} activos · {MONTHS[month-1]} {year}</p>
          </div>
          {isOwner && <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Empleado</button>}
        </div>

        <div className="emp-tabs">
          <button className={'emp-tab'+(tab==='equipo'?' active':'')} onClick={() => setTab('equipo')}>Equipo</button>
          <button className={'emp-tab'+(tab==='pagos'?' active':'')} onClick={() => setTab('pagos')}>Pagos del mes</button>
        </div>

        {loading ? <div className="emp-loading">Cargando...</div>
        : tab === 'equipo' ? (
          <div className="emp-grid">
            {users.map(user => (
              <div key={user.id} className={'emp-card card'+((!user.is_active)?' inactive':'')}>
                <div className="emp-card-top">
                  <div className="emp-avatar" style={{ background: ROLE_COLORS[user.role] || 'var(--accent)' }}>
                    {user.avatar_initials || user.name[0]}
                  </div>
                  <div className="emp-dot" style={{ background: user.is_active ? 'var(--success)' : 'var(--danger)' }} />
                </div>
                <div className="emp-info">
                  <div className="emp-name">{user.name}</div>
                  <div className="emp-role-tag" style={{ color: ROLE_COLORS[user.role] || 'var(--accent)', background: (ROLE_COLORS[user.role]||'var(--accent)')+'18' }}>
                    {ROLES[user.role]}
                  </div>
                  <div className="emp-email">{user.email}</div>
                  {user.hourly_rate && (
                    <div className="emp-rate">${Number(user.hourly_rate).toLocaleString('es-AR')}/h</div>
                  )}
                </div>
                {isOwner && (
                  <div className="emp-actions">
                    <button className="emp-action-btn" onClick={() => setAuditoriaUser(user)}>Auditoria</button>
                    <button className="emp-action-btn" onClick={() => setPasswordUser(user)}>Contraseña</button>
                    {user.role !== 'owner' && (
                      <>
                        <button className="emp-action-btn pay" onClick={() => setPagoUser(user)}>Pagar</button>
                        <button className={'emp-action-btn '+(user.is_active?'danger':'success')} onClick={() => handleToggle(user)}>
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="emp-action-btn danger" onClick={() => handleDelete(user)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                )}
                {!isOwner && (
                  <button className="emp-action-btn" onClick={() => setAuditoriaUser(user)}>Ver actividad</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="prod-table-wrap">
            <table className="prod-table">
              <thead>
                <tr><th>Empleado</th><th>Rol</th><th>Horas</th><th>Base</th><th>Bonif.</th><th>Desc.</th><th>Total</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {users.filter(u => u.role !== 'owner').map(user => {
                  const pago = payments.find(p => p.user_id === user.id)
                  return (
                    <tr key={user.id}>
                      <td><div className="p-name">{user.name}</div></td>
                      <td><span className="p-cat">{ROLES[user.role]}</span></td>
                      <td>{pago ? `${pago.total_hours}h` : '—'}</td>
                      <td>{pago ? `$${Number(pago.base_salary).toLocaleString('es-AR')}` : '—'}</td>
                      <td>{pago ? `$${Number(pago.bonuses).toLocaleString('es-AR')}` : '—'}</td>
                      <td>{pago ? `$${Number(pago.deductions).toLocaleString('es-AR')}` : '—'}</td>
                      <td className="p-price">{pago ? `$${Number(pago.total_pay).toLocaleString('es-AR')}` : '—'}</td>
                      <td>
                        {pago
                          ? <span className="p-status on">Registrado</span>
                          : isOwner && <button className="emp-action-btn pay" onClick={() => setPagoUser(user)}>Registrar</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <NuevoUsuarioModal
          onClose={() => setShowNew(false)}
          onSave={u => setUsers(prev => [u, ...prev])}
        />
      )}
      {pagoUser && (
        <PagoModal
          user={pagoUser} month={month} year={year}
          onClose={() => setPagoUser(null)}
          onSave={p => setPayments(prev => [...prev.filter(x => x.user_id !== p.user_id), p])}
        />
      )}
      {auditoriaUser && (
        <AuditoriaModal
          user={auditoriaUser}
          onClose={() => setAuditoriaUser(null)}
        />
      )}
      {passwordUser && (
        <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </Layout>
  )
}

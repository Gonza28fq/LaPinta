import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { ordersAPI, tablesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useNavigate } from 'react-router-dom'

const STATUS_COLOR = {
  pending:'var(--order-pending)', confirmed:'var(--order-confirmed)',
  in_kitchen:'var(--order-kitchen)', ready:'var(--order-ready)', delivered:'var(--success)',
}
const STATUS_LABEL = {
  pending:'Esperando confirmación', confirmed:'Confirmado',
  in_kitchen:'En cocina', ready:'¡Listo para retirar!', delivered:'Entregado',
}

export default function DashboardWaiter() {
  const { user } = useAuth()
  const { socket, unreadCount } = useSocket()
  const navigate = useNavigate()
  const [orders, setOrders]   = useState([])
  const [tables, setTables]   = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const load = async () => {
    try {
      const [o, t] = await Promise.all([
        ordersAPI.getAll(),
        tablesAPI.getAll(),
      ])
      setOrders(o)
      setTables(t)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!socket) return
    const events = ['order:new','order:confirmed','order:in_kitchen','order:ready','order:delivered','order:billed','table:available','table:status_changed']
    events.forEach(e => socket.on(e, load))
    return () => events.forEach(e => socket.off(e, load))
  }, [socket])

  const myOrders   = orders.filter(o => !['billed','cancelled'].includes(o.status))
  const readyOrders = myOrders.filter(o => o.status === 'ready')
  const myTables   = tables.filter(t => t.status === 'occupied' && myOrders.some(o => o.table_id === t.id))

  const greeting = () => {
    const h = now.getHours()
    if (h < 12) return 'Buenos dias'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <Layout>
      <div style={{ maxWidth: 700 }}>
        {/* Saludo */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {greeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {now.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
            {' · '}
            {now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>

        {/* Alerta de pedidos listos */}
        {readyOrders.length > 0 && (
          <div style={{
            background: 'rgba(74,154,74,.12)', border: '1px solid rgba(74,154,74,.4)',
            borderRadius: 10, padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--order-ready)' }}>
                🍔 {readyOrders.length} pedido{readyOrders.length > 1 ? 's' : ''} listo{readyOrders.length > 1 ? 's' : ''} para retirar
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                {readyOrders.map(o => `Mesa ${o.table_number}`).join(', ')}
              </div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => navigate('/pedidos')}>
              Ver pedidos
            </button>
          </div>
        )}

        {/* Stats rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Mis pedidos activos', val: myOrders.length,    color: 'var(--accent)' },
            { label: 'Mesas que atiendo',   val: myTables.length,    color: 'var(--order-confirmed)' },
            { label: 'Listos para retirar', val: readyOrders.length, color: 'var(--order-ready)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.04em' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Pedidos activos */}
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom: 10 }}>
          Mis pedidos activos
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign:'center', color:'var(--text-muted)' }}>Cargando...</div>
        ) : myOrders.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            No tenés pedidos activos. Podés crear uno desde{' '}
            <button style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', textDecoration:'underline' }} onClick={() => navigate('/mesas')}>
              Mesas
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {myOrders.map(order => {
              const elapsed = Math.floor((Date.now() - new Date(order.created_at)) / 60000)
              const cfg = STATUS_COLOR[order.status]
              return (
                <div key={order.id} className="card" style={{
                  borderLeft: `3px solid ${cfg}`,
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  cursor: 'pointer',
                }} onClick={() => navigate('/pedidos')}>
                  <div style={{ fontSize: 20, fontWeight: 700, color:'var(--text-primary)', minWidth: 36 }}>
                    {order.table_number || '—'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color:'var(--text-primary)' }}>
                      {order.customer_name || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: 11, color: cfg, marginTop: 2, fontWeight: 500 }}>
                      {STATUS_LABEL[order.status] || order.status}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color:'var(--accent)' }}>
                      ${Number(order.total).toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 11, color: elapsed > 20 ? 'var(--danger)' : 'var(--text-muted)', marginTop:2 }}>
                      {elapsed < 1 ? 'ahora' : `${elapsed} min`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Accesos rápidos */}
        <div style={{ fontSize: 12, fontWeight:500, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', margin:'20px 0 10px' }}>
          Accesos rápidos
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <button className="card btn btn-ghost" style={{ padding:16, flexDirection:'column', gap:6, alignItems:'flex-start', height:'auto' }} onClick={() => navigate('/mesas')}>
            <span style={{ fontSize:22 }}>⊞</span>
            <span style={{ fontSize:13, fontWeight:500 }}>Ver mesas</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Crear nuevos pedidos</span>
          </button>
          <button className="card btn btn-ghost" style={{ padding:16, flexDirection:'column', gap:6, alignItems:'flex-start', height:'auto' }} onClick={() => navigate('/pedidos')}>
            <span style={{ fontSize:22 }}>◎</span>
            <span style={{ fontSize:13, fontWeight:500 }}>Mis pedidos</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Gestionar pedidos activos</span>
          </button>
        </div>
      </div>
    </Layout>
  )
}

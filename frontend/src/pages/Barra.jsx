import { useEffect, useState } from 'react'
import { ordersAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Cocina.css'

const isOpenOrder = (status) => !['billed','cancelled'].includes(status)

export default function Barra() {
  const { logout } = useAuth()
  const { socket, connected } = useSocket()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  const hydrateBarOrders = async (baseOrders) => {
    const detailed = await Promise.all(
      baseOrders.filter(o => isOpenOrder(o.status)).map(o => ordersAPI.getById(o.id).catch(() => null))
    )
    return detailed
      .filter(Boolean)
      .map(order => ({ ...order, barItems: (order.items || []).filter(i => i.category === 'trago') }))
      .filter(order => order.barItems.length > 0)
  }

  const load = async () => {
    try {
      const all = await ordersAPI.getAll()
      setOrders(await hydrateBarOrders(all))
    } catch {
      toast.error('Error al cargar barra')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])

  useEffect(() => {
    if (!socket) return
    const onBarOrder = async (order) => {
      const detail = await ordersAPI.getById(order.id).catch(() => null)
      if (!detail) return
      const barItems = (detail.items || []).filter(i => i.category === 'trago')
      if (!barItems.length) return
      setOrders(prev => [{ ...detail, barItems }, ...prev.filter(x => x.id !== detail.id)])
      toast('Nuevo pedido de barra - Mesa ' + (detail.table_number || order.table_number || '-'), {
        duration: 8000,
        style: { background: '#2a3d5c', color: '#f0e8d8', fontWeight: 600, fontSize: 16 },
      })
    }
    const removeOrder = (order) => setOrders(prev => prev.filter(x => x.id !== order.id))

    socket.on('bar:new_order', onBarOrder)
    socket.on('order:billed', removeOrder)
    return () => {
      socket.off('bar:new_order', onBarOrder)
      socket.off('order:billed', removeOrder)
    }
  }, [socket])

  const markPrepared = (orderId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId))
    toast.success('Tragos preparados')
  }

  return (
    <div className="cocina-page">
      <div className="cocina-header">
        <div className="cocina-logo">La Pinta - Barra de tragos</div>
        <div className="cocina-clock">{now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</div>
        <div className="cocina-status">
          <div className={'cocina-dot' + (connected ? ' online' : ' offline')} />
          {connected ? 'Conectado' : 'Sin conexion'}
        </div>
        <button className="cocina-logout" onClick={logout}>Salir</button>
      </div>

      {loading ? (
        <div className="cocina-loading">Cargando tragos...</div>
      ) : orders.length === 0 ? (
        <div className="cocina-empty">
          <div className="cocina-empty-icon">OK</div>
          <div>Sin tragos pendientes</div>
        </div>
      ) : (
        <div className="cocina-grid">
          {orders.map(order => {
            const elapsed = Math.floor((Date.now() - new Date(order.updated_at || order.created_at)) / 60000)
            const urgent = elapsed >= 10
            return (
              <div key={order.id} className={'cocina-card' + (urgent ? ' urgent' : '')}>
                <div className="ck-top">
                  <div className="ck-mesa">{order.table_number ? `Mesa ${order.table_number}` : 'Delivery'}</div>
                  <div className={'ck-time' + (urgent ? ' urgent' : '')}>{elapsed < 1 ? 'Ahora' : `${elapsed} min`}</div>
                </div>
                {order.customer_name && <div className="ck-customer">{order.customer_name}</div>}
                {order.delivery_address && <div className="ck-notes">{order.delivery_address}</div>}
                <div className="ck-id">#{order.id.slice(-4).toUpperCase()}</div>
                <div className="ck-items">
                  {order.barItems.map((item, i) => (
                    <div key={i} className="ck-item">
                      <span className="ck-item-qty">{item.quantity}x</span>
                      <span className="ck-item-name">{item.product_name}</span>
                      {item.notes && <span className="ck-item-note"> - {item.notes}</span>}
                    </div>
                  ))}
                </div>
                {order.notes && <div className="ck-notes">{order.notes}</div>}
                <button className="ck-ready-btn" onClick={() => markPrepared(order.id)}>
                  Preparado
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

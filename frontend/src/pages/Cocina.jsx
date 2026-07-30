import { useState, useEffect } from 'react'
import { ordersAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Cocina.css'

const KITCHEN_EXCLUDED = ['bebida', 'trago']
const isKitchenItem = (item) => !KITCHEN_EXCLUDED.includes(item.category)

export default function Cocina() {
  const { logout } = useAuth()
  const { socket, connected } = useSocket()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  const hydrateKitchenOrder = async (order) => {
    const detail = await ordersAPI.getById(order.id).catch(() => null)
    if (!detail) return null
    const kitchenItems = (detail.items || []).filter(isKitchenItem)
    return kitchenItems.length ? { ...detail, kitchenItems } : null
  }

  const load = async () => {
    try {
      const all = await ordersAPI.getAll()
      const candidates = all.filter(o => ['confirmed','in_kitchen'].includes(o.status))
      const detailed = await Promise.all(candidates.map(hydrateKitchenOrder))
      setOrders(detailed.filter(Boolean))
    } catch {
      toast.error('Error al cargar cocina')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])

  useEffect(() => {
    if (!socket) return

    const upsertKitchenOrder = async (order) => {
      const detail = await hydrateKitchenOrder(order)
      if (!detail) {
        setOrders(prev => prev.filter(x => x.id !== order.id))
        return
      }
      setOrders(prev => [detail, ...prev.filter(x => x.id !== detail.id)])
      toast('Nuevo pedido de cocina - Mesa ' + (detail.table_number || order.table_number || '-'), {
        duration: 8000,
        style: { background: '#2a3d5c', color: '#f0e8d8', fontWeight: 600, fontSize: 16 },
      })
    }
    const updateStatus = async (order) => {
      const detail = await hydrateKitchenOrder(order)
      if (!detail) return
      setOrders(prev => prev.map(x => x.id === detail.id ? { ...detail, status: order.status } : x))
    }
    const removeOrder = (order) => setOrders(prev => prev.filter(x => x.id !== order.id))

    socket.on('order:confirmed', upsertKitchenOrder)
    socket.on('kitchen:new_order', updateStatus)
    socket.on('order:updated', updateStatus)
    socket.on('order:billed', removeOrder)

    return () => {
      socket.off('order:confirmed', upsertKitchenOrder)
      socket.off('kitchen:new_order', updateStatus)
      socket.off('order:updated', updateStatus)
      socket.off('order:billed', removeOrder)
    }
  }, [socket])

  const handleKitchenAction = async (order) => {
    try {
      if (order.status === 'confirmed') {
        const updated = await ordersAPI.updateStatus(order.id, 'in_kitchen')
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updated, kitchenItems: o.kitchenItems } : o))
        toast.success('Pedido tomado en cocina')
      } else {
        await ordersAPI.updateStatus(order.id, 'ready')
        setOrders(prev => prev.filter(o => o.id !== order.id))
        toast.success('Pedido de cocina despachado - Mesa ' + (order.table_number || '-'))
      }
    } catch {
      toast.error('Error')
    }
  }

  return (
    <div className="cocina-page">
      <div className="cocina-header">
        <div className="cocina-logo">La Pinta - Cocina</div>
        <div className="cocina-clock">{now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</div>
        <div className="cocina-status">
          <div className={'cocina-dot' + (connected ? ' online' : ' offline')} />
          {connected ? 'Conectado' : 'Sin conexion'}
        </div>
        <button className="cocina-logout" onClick={logout}>Salir</button>
      </div>

      {loading ? (
        <div className="cocina-loading">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="cocina-empty">
          <div className="cocina-empty-icon">OK</div>
          <div>Sin comida pendiente</div>
        </div>
      ) : (
        <div className="cocina-grid">
          {orders.map(order => {
            const elapsed = Math.floor((Date.now() - new Date(order.confirmed_at || order.created_at)) / 60000)
            const urgent = elapsed >= 15

            return (
              <div key={order.id} className={'cocina-card' + (urgent ? ' urgent' : '')}>
                <div className="ck-top">
                  <div className="ck-mesa">Mesa {order.table_number || '-'}</div>
                  <div className={'ck-time' + (urgent ? ' urgent' : '')}>
                    {elapsed < 1 ? 'Ahora' : `${elapsed} min`}
                  </div>
                </div>
                {order.customer_name && <div className="ck-customer">{order.customer_name}</div>}
                <div className="ck-id">#{order.id.slice(-4).toUpperCase()}</div>
                <div className="ck-items">
                  {order.kitchenItems.map((item, i) => (
                    <div key={i} className="ck-item">
                      <span className="ck-item-qty">{item.quantity}x</span>
                      <span className="ck-item-name">{item.product_name}</span>
                      {item.notes && <span className="ck-item-note"> - {item.notes}</span>}
                    </div>
                  ))}
                </div>
                {order.notes && <div className="ck-notes">{order.notes}</div>}
                <button className="ck-ready-btn" onClick={() => handleKitchenAction(order)}>
                  {order.status === 'confirmed' ? 'Tomar en cocina' : 'Listo - Despachar comida'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

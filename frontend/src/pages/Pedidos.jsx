import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { ordersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import NuevoPedidoModal from '../components/pedidos/NuevoPedidoModal'
import { openReceiptWindow, printReceipt } from '../utils/receipt'
import toast from 'react-hot-toast'
import './Pedidos.css'

// ---- Configuración de estados ----
const STATUS_CFG = {
  pending:    { label:'Pendiente',        color:'var(--order-pending)',   icon:'⏳' },
  confirmed:  { label:'Confirmado',       color:'var(--order-confirmed)', icon:'✓'  },
  in_kitchen: { label:'En cocina',        color:'var(--order-kitchen)',   icon:'👨‍🍳' },
  ready:      { label:'¡Listo!',          color:'var(--order-ready)',     icon:'🍔' },
  delivered:  { label:'Entregado',        color:'var(--success)',         icon:'✅' },
  billed:     { label:'Cobrado',          color:'var(--text-muted)',      icon:'💰' },
  cancelled:  { label:'Cancelado',        color:'var(--danger)',          icon:'✕'  },
}

// Qué puede hacer cada rol en cada estado
const ROLE_ACTIONS = {
  owner: {
    pending:    [{ label:'Confirmar y pasar a cocina', next:'confirmed', style:'primary' }, { label:'Cancelar', next:'cancelled', style:'danger' }],
    confirmed:  [{ label:'Pasar a cocina', next:'in_kitchen', style:'primary' }, { label:'Cancelar', next:'cancelled', style:'danger' }],
    in_kitchen: [{ label:'Marcar listo', next:'ready', style:'primary' }],
    ready:      [{ label:'Marcar entregado', next:'delivered', style:'primary' }],
    delivered:  [{ label:'Cobrar', next:'billed', style:'success' }],
  },
  manager: {
    pending:    [{ label:'Confirmar', next:'confirmed', style:'primary' }, { label:'Cancelar', next:'cancelled', style:'danger' }],
    confirmed:  [{ label:'Pasar a cocina', next:'in_kitchen', style:'primary' }, { label:'Cancelar', next:'cancelled', style:'danger' }],
    in_kitchen: [{ label:'Marcar listo', next:'ready', style:'primary' }],
    ready:      [{ label:'Marcar entregado', next:'delivered', style:'primary' }],
    delivered:  [{ label:'Cobrar', next:'billed', style:'success' }],
  },
  cashier: {
    pending:    [{ label:'Confirmar', next:'confirmed', style:'primary' }],
    confirmed:  [{ label:'Pasar a cocina', next:'in_kitchen', style:'primary' }],
    delivered:  [{ label:'Cobrar', next:'billed', style:'success' }],
  },
  waiter: {
    ready:      [{ label:'Retiré el pedido — Entregar', next:'delivered', style:'primary' }],
    delivered:  [{ label:'Solicitar cuenta', next:'bill_request', style:'ghost' }],
  },
}

const FILTERS = [
  { key:'all',        label:'Todos' },
  { key:'pending',    label:'Pendientes' },
  { key:'confirmed',  label:'Confirmados' },
  { key:'in_kitchen', label:'En cocina' },
  { key:'ready',      label:'Listos' },
  { key:'delivered',  label:'Entregados' },
]

// ---- Modal de detalle de pedido ----
function PedidoDetalle({ order, onClose, onAction, role }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ordersAPI.getById(order.id)
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [order.id])

  const cfg = STATUS_CFG[order.status] || {}
  const actions = ROLE_ACTIONS[role]?.[order.status] || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pedido-detalle-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Pedido #{order.id.slice(-4).toUpperCase()}</h2>
            <p className="modal-subtitle">
              Mesa {order.table_number || '—'} · {order.customer_name || 'Sin nombre'} · Mozo: {order.waiter_name}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="pd-status-badge" style={{ color:cfg.color, background:cfg.color+'18' }}>
              {cfg.icon} {cfg.label}
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="pd-body">
          {/* Items */}
          <div className="pd-items">
            <div className="pd-items-title">Ítems del pedido</div>
            {loading ? (
              <div className="pd-loading">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="pd-loading">Sin ítems</div>
            ) : (
              items.map((item, i) => (
                <div key={i} className="pd-item-row">
                  <div className="pd-item-qty">{item.quantity}×</div>
                  <div className="pd-item-info">
                    <div className="pd-item-name">
                      {item.product_id === null && <span className="pd-custom-tag">personalizado</span>}
                      {item.product_name}
                    </div>
                    {item.notes && <div className="pd-item-notes">{item.notes}</div>}
                  </div>
                  <div className="pd-item-price">${Number(item.subtotal).toLocaleString('es-AR')}</div>
                </div>
              ))
            )}
          </div>

          {/* Total y timestamps */}
          <div className="pd-sidebar">
            <div className="pd-total-box">
              <div className="pd-total-label">Total del pedido</div>
              <div className="pd-total-val">${Number(order.total).toLocaleString('es-AR')}</div>
            </div>

            <div className="pd-timeline">
              <div className="pd-tl-title">Historial</div>
              {[
                { label:'Creado',    time:order.created_at,   show:true },
                { label:'Confirmado',time:order.confirmed_at, show:!!order.confirmed_at },
                { label:'A cocina',  time:order.kitchen_at,   show:!!order.kitchen_at },
                { label:'Listo',     time:order.ready_at,     show:!!order.ready_at },
                { label:'Entregado', time:order.delivered_at, show:!!order.delivered_at },
                { label:'Cobrado',   time:order.billed_at,    show:!!order.billed_at },
              ].filter(t => t.show).map((t, i) => (
                <div key={i} className="pd-tl-row">
                  <div className="pd-tl-dot" />
                  <div className="pd-tl-label">{t.label}</div>
                  <div className="pd-tl-time">
                    {new Date(t.time).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="pd-notes-box">
                <div className="pd-notes-label">Notas</div>
                <div className="pd-notes-text">{order.notes}</div>
              </div>
            )}

            {/* Acciones del rol */}
            <div className="pd-actions">
              {actions.map((action, i) => (
                <button
                  key={i}
                  className={`btn pd-action-btn ${
                    action.style === 'primary' ? 'btn-primary' :
                    action.style === 'success' ? 'btn-primary' :
                    action.style === 'danger'  ? 'btn-danger'  : 'btn-ghost'
                  }`}
                  style={action.style === 'success' ? { background:'var(--success)', color:'#fff' } : {}}
                  onClick={() => onAction(order, action.next)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Modal de cobro ----
function CobroModal({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash')
  const [tip, setTip] = useState('')
  const [saving, setSaving] = useState(false)
  const { paymentsAPI } = require('../services/api')
  const total = Number(order.total)
  const tipAmt = parseFloat(tip) || 0

  const METHODS = [
    { id:'cash',     label:'Efectivo',       icon:'💵' },
    { id:'card',     label:'Tarjeta',         icon:'💳' },
    { id:'transfer', label:'Transferencia',   icon:'🏦' },
    { id:'qr',       label:'QR / Mercado Pago', icon:'📱' },
  ]

  const handleCobrar = async (emitReceipt = false) => {
    setSaving(true)
    const receiptWindow = emitReceipt ? openReceiptWindow() : null
    try {
      const detail = emitReceipt ? await ordersAPI.getById(order.id) : null
      await paymentsAPI.create({ order_id: order.id, method, amount: total, tip: tipAmt })
      if (emitReceipt) printReceipt({ order, items: detail?.items || [], method, tip: tipAmt, targetWindow: receiptWindow })
      toast.success('Mesa cerrada · $' + (total + tipAmt).toLocaleString('es-AR'))
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cobrar')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cobro-modal-full">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Cobrar pedido</h2>
            <p className="modal-subtitle">Mesa {order.table_number} · {order.customer_name}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cobro-body-full">
          <div className="cobro-total-big">
            <div className="cobro-total-lbl">Total a cobrar</div>
            <div className="cobro-total-num">${total.toLocaleString('es-AR')}</div>
          </div>

          <div className="form-row">
            <label>Método de pago</label>
            <div className="cobro-methods-grid">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  className={'cobro-method-btn' + (method === m.id ? ' active' : '')}
                  onClick={() => setMethod(m.id)}
                >
                  <span className="cm-icon">{m.icon}</span>
                  <span className="cm-label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Propina (opcional)</label>
            <input
              type="number" value={tip}
              onChange={e => setTip(e.target.value)}
              placeholder="$0" min="0"
            />
          </div>

          {tipAmt > 0 && (
            <div className="cobro-total-con-propina">
              Total con propina: <strong>${(total + tipAmt).toLocaleString('es-AR')}</strong>
            </div>
          )}

          <div className="cobro-print-actions">
            <button className="btn btn-ghost cobro-confirm-btn" onClick={() => handleCobrar(true)} disabled={saving}>
              Cobrar e imprimir
            </button>
            <button
              className="btn btn-primary cobro-confirm-btn"
              onClick={() => handleCobrar(false)}
              disabled={saving}
            >
              {saving ? 'Procesando...' : '💰 Confirmar cobro · $' + (total + tipAmt).toLocaleString('es-AR')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Página principal ----
export default function Pedidos() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [cobroOrder, setCobroOrder] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [showDelivery, setShowDelivery] = useState(false)

  const loadOrders = async () => {
    setLoading(true)
    try { setOrders(await ordersAPI.getAll()) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { loadOrders() }, [])

  // Socket — actualizar pedidos en tiempo real
  useEffect(() => {
    if (!socket) return
    const updateOrder = (o) => {
      setOrders(prev => {
        const exists = prev.find(x => x.id === o.id)
        return exists
          ? prev.map(x => x.id === o.id ? { ...x, ...o } : x)
          : [o, ...prev]
      })
      // Actualizar el detalle si está abierto
      setSelected(prev => prev?.id === o.id ? { ...prev, ...o } : prev)
    }

    const events = ['order:new','order:updated','order:payment','order:confirmed','order:in_kitchen','order:ready','order:delivered','order:billed']
    events.forEach(e => socket.on(e, updateOrder))

    // Notificaciones visuales según rol
    socket.on('order:new', o => {
      if (['cashier','manager','owner'].includes(user?.role)) {
        toast('🆕 Nuevo pedido — Mesa ' + (o.table_number || '—'), {
          duration: 6000,
          style: { background: 'var(--order-pending)', color: '#fff', fontWeight: 600 }
        })
      }
    })
    socket.on('order:confirmed', o => {
      if (user?.role === 'waiter' && o.waiter_id === user.id) {
        toast('✓ Pedido confirmado — Mesa ' + o.table_number, { duration: 5000 })
      }
    })
    socket.on('order:ready', o => {
      if (user?.role === 'waiter') {
        toast('🍔 ¡Pedido listo! — Mesa ' + o.table_number, {
          duration: 8000,
          style: { background: 'var(--order-ready)', color: '#fff', fontWeight: 600 }
        })
      }
    })
    socket.on('order:bill_requested', o => {
      if (['cashier','manager','owner'].includes(user?.role)) {
        toast('💰 Mesa ' + o.table_number + ' pide la cuenta', {
          duration: 8000,
          style: { background: 'var(--warning)', color: '#fff', fontWeight: 600 }
        })
      }
    })

    return () => {
      events.forEach(e => socket.off(e, updateOrder))
      ;['order:new','order:updated','order:payment','order:confirmed','order:ready','order:bill_requested'].forEach(e => socket.off(e))
    }
  }, [socket, user])

  const handleAction = async (order, next) => {
    // Caso especial: solicitar cuenta
    if (next === 'bill_request') {
      try {
        await ordersAPI.requestBill(order.id)
        toast.success('Solicitud enviada al cajero')
        setSelected(null)
      } catch { toast.error('Error al solicitar cuenta') }
      return
    }

    // Caso especial: cobrar → abrir modal de pago
    if (next === 'billed') {
      setCobroOrder(order)
      setSelected(null)
      return
    }

    setUpdating(order.id)
    try {
      const updated = await ordersAPI.updateStatus(order.id, next)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updated } : o))
      setSelected(null)
      toast.success('Pedido actualizado → ' + STATUS_CFG[next]?.label)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar')
    } finally { setUpdating(null) }
  }

  const filtered = filter === 'all'
    ? orders.filter(o => !['billed','cancelled'].includes(o.status))
    : orders.filter(o => o.status === filter)

  const countByStatus = (s) => orders.filter(o => o.status === s).length

  return (
    <Layout>
      <div className="pedidos-page">
        {/* Header */}
        <div className="ped-header">
          <div>
            <h1 className="ped-title">Pedidos</h1>
            <p className="ped-subtitle">
              {['cashier','manager','owner'].includes(user?.role)
                ? 'Vista de caja — confirmá y gestioná los pedidos'
                : user?.role === 'waiter'
                ? 'Tus pedidos activos'
                : 'Gestión de pedidos'}
            </p>
          </div>
          <div className="ped-header-actions">
            {['owner','manager','waiter','cashier'].includes(user?.role) && (
              <button className="btn btn-primary" onClick={() => setShowDelivery(true)}>+ Delivery</button>
            )}
            <div className="ped-live-indicator">
              <div className="ped-live-dot" />
              <span>En tiempo real</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="ped-filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={'filter-btn' + (filter === f.key ? ' active' : '')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className={'filter-count' + (countByStatus(f.key) > 0 ? ' has-items' : '')}>
                  {countByStatus(f.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Instrucción según rol */}
        {user?.role === 'cashier' && countByStatus('pending') > 0 && (
          <div className="ped-role-hint cashier">
            💰 Tenés {countByStatus('pending')} pedido{countByStatus('pending') > 1 ? 's' : ''} esperando confirmación
          </div>
        )}
        {user?.role === 'waiter' && countByStatus('ready') > 0 && (
          <div className="ped-role-hint waiter">
            🍔 ¡Tenés {countByStatus('ready')} pedido{countByStatus('ready') > 1 ? 's' : ''} listo{countByStatus('ready') > 1 ? 's' : ''} para retirar!
          </div>
        )}

        {/* Grid de pedidos */}
        {loading ? (
          <div className="ped-loading">Cargando pedidos...</div>
        ) : filtered.length === 0 ? (
          <div className="ped-empty">
            {filter === 'all' ? 'No hay pedidos activos' : 'No hay pedidos en este estado'}
          </div>
        ) : (
          <div className="ped-grid">
            {filtered.map(order => {
              const cfg = STATUS_CFG[order.status] || {}
              const actions = ROLE_ACTIONS[user?.role]?.[order.status] || []
              const isUpd = updating === order.id
              const elapsed = Math.floor((Date.now() - new Date(order.created_at)) / 60000)

              return (
                <div
                  key={order.id}
                  className={'ped-card' + (order.status === 'ready' ? ' card-ready' : '') + (order.status === 'pending' ? ' card-pending' : '')}
                  onClick={() => setSelected(order)}
                >
                  {/* Top */}
                  <div className="ped-card-top">
                    <div className="ped-id">#{order.id.slice(-4).toUpperCase()}</div>
                    <div className="ped-table">Mesa {order.table_number || '—'}</div>
                    <div className="ped-badge" style={{ color:cfg.color, background:cfg.color+'18' }}>
                      {cfg.icon} {cfg.label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="ped-info">
                    {order.customer_name && <div className="ped-customer">{order.customer_name}</div>}
                    <div className="ped-meta-row">
                      <span className="ped-waiter">{order.waiter_name}</span>
                      <span className="ped-elapsed" style={{ color: elapsed > 20 ? 'var(--danger)' : elapsed > 10 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {elapsed < 1 ? 'ahora' : `${elapsed} min`}
                      </span>
                    </div>
                    <div className="ped-items-count">{order.items_count} ítem{order.items_count !== 1 ? 's' : ''}</div>
                    <div className="ped-total">${Number(order.total).toLocaleString('es-AR')}</div>
                  </div>

                  {/* Acciones rápidas (sin abrir modal) */}
                  {actions.length > 0 && (
                    <div className="ped-quick-actions" onClick={e => e.stopPropagation()}>
                      {actions.slice(0, 1).map((action, i) => (
                        <button
                          key={i}
                          className={`btn ped-quick-btn ${
                            action.style === 'primary' ? 'btn-primary' :
                            action.style === 'success' ? 'btn-primary' :
                            action.style === 'danger'  ? 'btn-danger'  : 'btn-ghost'
                          }`}
                          style={action.style === 'success' ? { background:'var(--success)' } : {}}
                          disabled={isUpd}
                          onClick={() => handleAction(order, action.next)}
                        >
                          {isUpd ? '...' : action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="ped-tap-hint">Tocar para ver detalle</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {selected && (
        <PedidoDetalle
          order={selected}
          role={user?.role}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}

      {/* Modal cobro */}
      {cobroOrder && (
        <CobroModal
          order={cobroOrder}
          onClose={() => setCobroOrder(null)}
          onDone={() => { loadOrders(); setCobroOrder(null) }}
        />
      )}
      {showDelivery && (
        <NuevoPedidoModal
          onClose={() => { setShowDelivery(false); loadOrders() }}
        />
      )}
    </Layout>
  )
}

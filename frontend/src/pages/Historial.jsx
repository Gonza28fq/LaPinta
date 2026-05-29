import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { historialAPI } from '../services/api'
import toast from 'react-hot-toast'
import './Historial.css'

const STATUS_CFG = {
  pending:    { label:'Pendiente',  color:'var(--order-pending)'  },
  confirmed:  { label:'Confirmado', color:'var(--order-confirmed)'},
  in_kitchen: { label:'En cocina',  color:'var(--order-kitchen)'  },
  ready:      { label:'Listo',      color:'var(--order-ready)'    },
  delivered:  { label:'Entregado',  color:'var(--success)'        },
  billed:     { label:'Cobrado',    color:'var(--success)'        },
  cancelled:  { label:'Cancelado',  color:'var(--danger)'         },
}

const METHOD_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', qr:'QR' }
const METHOD_ICON  = { cash:'💵', card:'💳', transfer:'🏦', qr:'📱' }

function PedidoDetalleModal({ order, onClose }) {
  if (!order) return null
  const cfg = STATUS_CFG[order.status] || {}
  const elapsed = order.billed_at && order.created_at
    ? Math.round((new Date(order.billed_at) - new Date(order.created_at)) / 60000)
    : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hist-detalle-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Pedido #{order.id.slice(-6).toUpperCase()}</h2>
            <p className="modal-subtitle">
              Mesa {order.table_number || '—'} · {order.customer_name || 'Sin nombre'}
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="hist-badge" style={{ color:cfg.color, background:cfg.color+'18' }}>{cfg.label}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="hist-modal-body">
          {/* Items */}
          <div className="hist-items">
            <div className="hist-section-title">Ítems</div>
            {(order.items || []).map((item, i) => (
              <div key={i} className="hist-item-row">
                <span className="hist-item-qty">{item.quantity}×</span>
                <span className="hist-item-name">{item.product_name}</span>
                <span className="hist-item-price">${Number(item.subtotal).toLocaleString('es-AR')}</span>
              </div>
            ))}
            <div className="hist-item-total">
              <span>Total</span>
              <span>${Number(order.total).toLocaleString('es-AR')}</span>
            </div>
          </div>

          {/* Info */}
          <div className="hist-info">
            <div className="hist-info-row"><span>Mozo</span><strong>{order.waiter_name || '—'}</strong></div>
            {order.cashier_name && <div className="hist-info-row"><span>Cajero</span><strong>{order.cashier_name}</strong></div>}
            {order.payment_method && (
              <div className="hist-info-row">
                <span>Pago</span>
                <strong>{METHOD_ICON[order.payment_method]} {METHOD_LABEL[order.payment_method]}</strong>
              </div>
            )}
            {order.payment_tip > 0 && (
              <div className="hist-info-row"><span>Propina</span><strong>${Number(order.payment_tip).toLocaleString('es-AR')}</strong></div>
            )}
            {elapsed !== null && (
              <div className="hist-info-row"><span>Tiempo total</span><strong>{elapsed} min</strong></div>
            )}
            {order.notes && <div className="hist-info-row"><span>Notas</span><strong>{order.notes}</strong></div>}

            <div className="hist-divider" />
            <div className="hist-section-title">Timeline</div>
            {[
              { label:'Creado',     time:order.created_at   },
              { label:'Confirmado', time:order.confirmed_at },
              { label:'A cocina',   time:order.kitchen_at   },
              { label:'Listo',      time:order.ready_at     },
              { label:'Entregado',  time:order.delivered_at },
              { label:'Cobrado',    time:order.billed_at    },
            ].filter(t => t.time).map((t, i) => (
              <div key={i} className="hist-tl-row">
                <div className="hist-tl-dot" />
                <span className="hist-tl-label">{t.label}</span>
                <span className="hist-tl-time">
                  {new Date(t.time).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Historial() {
  const today = new Date().toISOString().split('T')[0]
  const [filters, setFilters] = useState({ date: today, status: '', waiter_id: '', table_number: '' })
  const [orders, setOrders]   = useState([])
  const [totals, setTotals]   = useState(null)
  const [waiters, setWaiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  useEffect(() => {
    historialAPI.getWaiters().then(setWaiters).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [filters])

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.date)         params.date         = filters.date
      if (filters.status)       params.status       = filters.status
      if (filters.waiter_id)    params.waiter_id    = filters.waiter_id
      if (filters.table_number) params.table_number = filters.table_number
      const data = await historialAPI.getAll(params)
      setOrders(data.orders)
      setTotals(data.totals)
    } catch { toast.error('Error al cargar historial') }
    finally { setLoading(false) }
  }

  const handleRowClick = async (order) => {
    try {
      const full = await historialAPI.getById(order.id)
      setSelected(full)
    } catch { toast.error('Error al cargar detalle') }
  }

  const exportCSV = () => {
    const headers = ['ID','Mesa','Cliente','Mozo','Estado','Total','Método','Propina','Hora']
    const rows = orders.map(o => [
      o.id.slice(-6).toUpperCase(),
      o.table_number || '—',
      o.customer_name || '—',
      o.waiter_name || '—',
      STATUS_CFG[o.status]?.label || o.status,
      o.total,
      METHOD_LABEL[o.payment_method] || '—',
      o.payment_tip || 0,
      new Date(o.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `lapinta_pedidos_${filters.date || 'historial'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="historial-page">
        {/* Header */}
        <div className="hist-header">
          <div>
            <h1 className="hist-title">Historial de pedidos</h1>
            <p className="hist-subtitle">
              {totals ? `${totals.orders} pedidos · ${totals.billed} cobrados` : 'Cargando...'}
            </p>
          </div>
          <button className="btn btn-ghost hist-export" onClick={exportCSV}>
            ⬇ Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="hist-filters">
          <div className="hist-filter-group">
            <label>Fecha</label>
            <input type="date" value={filters.date} onChange={e => setF('date', e.target.value)} />
          </div>
          <div className="hist-filter-group">
            <label>Estado</label>
            <select value={filters.status} onChange={e => setF('status', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="hist-filter-group">
            <label>Mozo</label>
            <select value={filters.waiter_id} onChange={e => setF('waiter_id', e.target.value)}>
              <option value="">Todos</option>
              {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="hist-filter-group">
            <label>Mesa</label>
            <input
              type="number" placeholder="Nº"
              value={filters.table_number}
              onChange={e => setF('table_number', e.target.value)}
              style={{ width: 70 }}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setFilters({ date:today, status:'', waiter_id:'', table_number:'' })}>
            ↺ Limpiar
          </button>
        </div>

        {/* Totales del período */}
        {totals && (
          <div className="hist-totals">
            <div className="hist-total-card">
              <div className="htc-label">Recaudado</div>
              <div className="htc-val accent">${totals.revenue.toLocaleString('es-AR')}</div>
            </div>
            <div className="hist-total-card">
              <div className="htc-label">Propinas</div>
              <div className="htc-val">${totals.tips.toLocaleString('es-AR')}</div>
            </div>
            <div className="hist-total-card">
              <div className="htc-label">Ticket promedio</div>
              <div className="htc-val">${Math.round(totals.avg_ticket).toLocaleString('es-AR')}</div>
            </div>
            <div className="hist-total-card">
              <div className="htc-label">Cobrados</div>
              <div className="htc-val">{totals.billed}</div>
            </div>
            <div className="hist-total-card">
              <div className="htc-label">Cancelados</div>
              <div className="htc-val" style={{ color: totals.cancelled > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {totals.cancelled}
              </div>
            </div>
            {Object.entries(totals.by_method).map(([method, amount]) => (
              <div key={method} className="hist-total-card">
                <div className="htc-label">{METHOD_ICON[method]} {METHOD_LABEL[method]}</div>
                <div className="htc-val">${Number(amount).toLocaleString('es-AR')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="hist-loading">Cargando historial...</div>
        ) : orders.length === 0 ? (
          <div className="hist-empty">No hay pedidos con los filtros seleccionados</div>
        ) : (
          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mesa</th>
                  <th>Cliente</th>
                  <th>Mozo</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Método</th>
                  <th>Hora</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const cfg = STATUS_CFG[order.status] || {}
                  const elapsed = order.billed_at && order.created_at
                    ? Math.round((new Date(order.billed_at) - new Date(order.created_at)) / 60000)
                    : null
                  return (
                    <tr key={order.id} className="hist-row" onClick={() => handleRowClick(order)}>
                      <td className="td-id">#{order.id.slice(-6).toUpperCase()}</td>
                      <td>Mesa {order.table_number || '—'}</td>
                      <td>{order.customer_name || '—'}</td>
                      <td className="td-muted">{order.waiter_name || '—'}</td>
                      <td>
                        <span className="hist-badge" style={{ color:cfg.color, background:cfg.color+'18' }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="td-total">${Number(order.total).toLocaleString('es-AR')}</td>
                      <td className="td-muted">
                        {order.payment_method
                          ? `${METHOD_ICON[order.payment_method]} ${METHOD_LABEL[order.payment_method]}`
                          : '—'}
                      </td>
                      <td className="td-muted">
                        {new Date(order.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="td-muted">
                        {elapsed !== null
                          ? <span style={{ color: elapsed > 30 ? 'var(--danger)' : elapsed > 20 ? 'var(--warning)' : 'var(--success)' }}>
                              {elapsed} min
                            </span>
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <PedidoDetalleModal order={selected} onClose={() => setSelected(null)} />}
    </Layout>
  )
}
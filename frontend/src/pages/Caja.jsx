import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { ordersAPI, paymentsAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { openReceiptWindow, printReceipt } from '../utils/receipt'
import toast from 'react-hot-toast'
import './Caja.css'

const METHODS = [
  {id:'cash',label:'Efectivo',icon:'💵'},
  {id:'card',label:'Tarjeta',icon:'💳'},
  {id:'transfer',label:'Transferencia',icon:'🏦'},
  {id:'qr',label:'QR',icon:'📱'},
]

function CobroModal({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash')
  const [tip, setTip] = useState('')
  const [saving, setSaving] = useState(false)
  const total = Number(order.total)
  const tipAmt = parseFloat(tip) || 0

  const handleCobrar = async (emitReceipt = false) => {
    setSaving(true)
    const receiptWindow = emitReceipt ? openReceiptWindow() : null
    try {
      const detail = emitReceipt ? await ordersAPI.getById(order.id) : null
      await paymentsAPI.create({ order_id:order.id, method, amount:total, tip:tipAmt })
      await ordersAPI.updateStatus(order.id, 'billed')
      if (emitReceipt) printReceipt({ order, items: detail?.items || [], method, tip: tipAmt, targetWindow: receiptWindow })
      toast.success('Cobrado $' + (total+tipAmt).toLocaleString('es-AR'))
      onDone(); onClose()
    } catch { toast.error('Error al registrar cobro') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="cobro-modal">
        <div className="modal-header">
          <div><h2 className="modal-title">Cobrar pedido</h2><p className="modal-subtitle">Mesa {order.table_number||'—'} · {order.customer_name}</p></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cobro-body">
          <div className="cobro-total-display">
            <span className="cobro-total-label">Total a cobrar</span>
            <span className="cobro-total-amt">${total.toLocaleString('es-AR')}</span>
          </div>
          <div className="form-row">
            <label>Medio de pago</label>
            <div className="payment-methods">
              {METHODS.map(m=>(
                <button key={m.id} className={'pm-btn ' + (method===m.id?'active':'')} onClick={()=>setMethod(m.id)}>
                  <span>{m.icon}</span><span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>Propina (opcional)</label>
            <input type="number" value={tip} onChange={e=>setTip(e.target.value)} placeholder="$0" min="0"/>
          </div>
          {tipAmt>0 && <div className="cobro-con-propina">Total con propina: <strong>${(total+tipAmt).toLocaleString('es-AR')}</strong></div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-ghost" onClick={() => handleCobrar(true)} disabled={saving}>
            Cobrar e imprimir
          </button>
          <button className="btn btn-primary" style={{minWidth:160}} onClick={() => handleCobrar(false)} disabled={saving}>
            {saving ? 'Registrando...' : 'Cobrar $' + (total+tipAmt).toLocaleString('es-AR')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Caja() {
  const [orders, setOrders] = useState([])
  const [closing, setClosing] = useState([])
  const [cobroOrder, setCobroOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()

  const loadAll = async () => {
    setLoading(true)
    try {
      const [all, cl] = await Promise.all([ordersAPI.getAll(), paymentsAPI.getCashClosing()])
      setOrders(all.filter(o=>['pending','confirmed','in_kitchen','ready','delivered'].includes(o.status)))
      setClosing(cl)
    } catch {} finally { setLoading(false) }
  }

  useEffect(()=>{ loadAll() },[])
  useEffect(()=>{
    if(!socket) return
    const r = ()=>loadAll()
    ;['order:new','order:billed','order:confirmed'].forEach(e=>socket.on(e,r))
    return ()=>['order:new','order:billed','order:confirmed'].forEach(e=>socket.off(e,r))
  },[socket])

  const handleConfirm = async (order) => {
    try {
      await ordersAPI.updateStatus(order.id,'confirmed')
      setOrders(p=>p.map(o=>o.id===order.id?{...o,status:'confirmed'}:o))
      toast.success('Pedido #' + order.id.slice(-4).toUpperCase() + ' confirmado')
    } catch { toast.error('Error al confirmar') }
  }

  const totalHoy = closing.reduce((s,r)=>s+parseFloat(r.total||0),0)
  const totalTips = closing.reduce((s,r)=>s+parseFloat(r.tips||0),0)
  const ST_LABEL = {pending:'Pendiente',confirmed:'Confirmado',in_kitchen:'En cocina',ready:'Listo',delivered:'Entregado'}

  return (
    <Layout>
      <div className="caja-page">
        <div className="caja-header">
          <h1 className="caja-title">Caja</h1>
          <p className="caja-date">{new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div className="caja-stats">
          <div className="card caja-stat"><div className="cs-label">Recaudado hoy</div><div className="cs-val accent">${totalHoy.toLocaleString('es-AR')}</div></div>
          <div className="card caja-stat"><div className="cs-label">Propinas</div><div className="cs-val">${totalTips.toLocaleString('es-AR')}</div></div>
          <div className="card caja-stat"><div className="cs-label">Pedidos activos</div><div className="cs-val">{orders.length}</div></div>
          {closing.map(r=>(
            <div key={r.method} className="card caja-stat">
              <div className="cs-label">{METHODS.find(m=>m.id===r.method)?.label||r.method}</div>
              <div className="cs-val">${Number(r.total).toLocaleString('es-AR')}</div>
              <div className="cs-count">{r.count} cobros</div>
            </div>
          ))}
        </div>
        <div className="caja-section-title">Pedidos activos</div>
        {loading ? <div className="caja-loading">Cargando...</div>
        : orders.length===0 ? <div className="caja-empty">No hay pedidos activos</div>
        : (
          <div className="caja-orders">
            {orders.map(order=>(
              <div key={order.id} className={'caja-card st-' + order.status}>
                <div className="caja-card-top">
                  <span className="caja-id">#{order.id.slice(-4).toUpperCase()}</span>
                  <span className="caja-table">Mesa {order.table_number||'—'}</span>
                  <span className={'caja-badge st-' + order.status}>{ST_LABEL[order.status]}</span>
                </div>
                {order.customer_name && <div className="caja-customer">{order.customer_name}</div>}
                <div className="caja-meta">
                  <span>Mozo: {order.waiter_name}</span>
                  <span>{new Date(order.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                <div className="caja-total">${Number(order.total).toLocaleString('es-AR')}</div>
                <div className="caja-actions">
                  {order.status==='pending' && <button className="btn btn-ghost caja-btn" onClick={()=>handleConfirm(order)}>Confirmar</button>}
                  {order.status==='delivered' && <button className="btn btn-primary caja-btn" onClick={()=>setCobroOrder(order)}>💰 Cobrar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {cobroOrder && <CobroModal order={cobroOrder} onClose={()=>setCobroOrder(null)} onDone={loadAll}/>}
    </Layout>
  )
}

import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/layout/Layout'
import { metricsAPI, ordersAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import './Dashboard.css'

const STATUS_COLORS = {
  pending:'var(--order-pending)', confirmed:'var(--order-confirmed)',
  in_kitchen:'var(--order-kitchen)', ready:'var(--order-ready)', delivered:'var(--success)',
}
const STATUS_LABEL = {
  pending:'Pendientes', confirmed:'Confirmados',
  in_kitchen:'En cocina', ready:'Listos', delivered:'Entregados',
}
const METHOD_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', qr:'QR' }
const METHOD_ICON  = { cash:'💵', card:'💳', transfer:'🏦', qr:'📱' }
const METHOD_COLOR = { cash:'#4a9a4a', card:'#4a80c8', transfer:'#9a4ac8', qr:'#C8A96A' }
const formatDateInput = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const getBusinessDate = () => {
  const d = new Date()
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return formatDateInput(d)
}

// Barra horizontal
function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="hbar-row">
      <div className="hbar-label">{label}</div>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width:`${pct}%`, background: color || 'var(--accent)' }} />
      </div>
      <div className="hbar-val">{sub || value}</div>
    </div>
  )
}

// Gráfico de barras verticales
function VBarChart({ data, valueKey, labelKey, color, formatVal }) {
  const max = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 1)
  return (
    <div className="vbar-chart">
      {data.map((d, i) => {
        const val = parseFloat(d[valueKey]) || 0
        const pct = (val / max) * 100
        return (
          <div key={i} className="vbar-col">
            <div className="vbar-val">{val > 0 ? (formatVal ? formatVal(val) : val) : ''}</div>
            <div className="vbar-wrap">
              <div className="vbar-fill" style={{ height:`${pct}%`, background: color || 'var(--accent)' }} />
            </div>
            <div className="vbar-label">{d[labelKey]}</div>
          </div>
        )
      })}
    </div>
  )
}

// Selector de período
function PeriodSelector({ value, onChange }) {
  const today = getBusinessDate()
  const getWeek = () => {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return formatDateInput(d)
  }
  const getMonth = () => {
    const d = new Date(); d.setDate(1)
    return formatDateInput(d)
  }
  const options = [
    { label:'Hoy',    from:today,        to:today },
    { label:'7 días', from:getWeek(),    to:today },
    { label:'Mes',    from:getMonth(),   to:today },
  ]
  return (
    <div className="period-selector">
      {options.map(opt => (
        <button
          key={opt.label}
          className={'period-btn' + (value.label === opt.label ? ' active' : '')}
          onClick={() => onChange(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const today = getBusinessDate()
  const [period, setPeriod]         = useState({ label:'Hoy', from:today, to:today })
  const [summary, setSummary]       = useState(null)
  const [liveOrders, setLiveOrders] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [byMethod, setByMethod]     = useState([])
  const [byWaiter, setByWaiter]     = useState([])
  const [loading, setLoading]       = useState(true)
  const { socket } = useSocket()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sum, orders, prods, methods, waiters] = await Promise.all([
        metricsAPI.getSummary(today),
        ordersAPI.getAll({ date: today }),
        api.get('/metrics/top-products', { params: { from: period.from, to: period.to } }).then(r => r.data || r),
        api.get('/metrics/by-method',    { params: { from: period.from, to: period.to } }).then(r => r.data || r),
        api.get('/metrics/by-waiter',    { params: { from: period.from, to: period.to } }).then(r => r.data || r),
      ])
      setSummary(sum)
      setLiveOrders((orders.data || orders).filter(o => !['billed','cancelled'].includes(o.status)))
      setTopProducts(prods)
      setByMethod(methods)
      setByWaiter(waiters)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [period, today])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!socket) return
    const events = ['order:new','order:confirmed','order:in_kitchen','order:ready','order:billed']
    events.forEach(e => socket.on(e, load))
    return () => events.forEach(e => socket.off(e, load))
  }, [socket, load])

  const revenue  = parseFloat(summary?.revenue?.total || 0)
  const tips     = parseFloat(summary?.revenue?.tips  || 0)
  const avg      = parseFloat(summary?.avgTicket?.avg || 0)
  const totalOrd = summary?.orders?.reduce((s, r) => s + parseInt(r.total), 0) || 0
  const billed   = summary?.orders?.find(r => r.status === 'billed')?.total || 0

  const maxProd    = topProducts[0]?.qty       ? parseInt(topProducts[0].qty)       : 1
  const maxSales   = topProducts[0]?.revenue   ? parseFloat(topProducts[0].revenue) : 1
  const maxWaiter  = byWaiter[0]?.total_sales  ? parseFloat(byWaiter[0].total_sales): 1
  const totalMethod= byMethod.reduce((s, m) => s + parseFloat(m.total || 0), 0)
  const firstName = user?.name?.split(' ')[0] || ''
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos dias'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  if (loading) return <Layout><div style={{padding:40,color:'var(--text-secondary)'}}>Cargando dashboard...</div></Layout>

  return (
    <Layout>
      <div className="dash-page">
        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 className="dash-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
            <p className="dash-date">{new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={load}>↻ Actualizar</button>
        </div>

        {/* KPIs del día */}
        <div className="dash-kpis">
          {[
            { label:'Recaudado hoy',    value:`$${revenue.toLocaleString('es-AR')}`, sub:`+ $${tips.toLocaleString('es-AR')} propinas`, accent:true },
            { label:'Pedidos hoy',      value:totalOrd,   sub:`${billed} cobrados` },
            { label:'Ticket promedio',  value:avg>0?`$${Math.round(avg).toLocaleString('es-AR')}`:'—' },
            { label:'Pedidos activos',  value:liveOrders.length, sub:'ahora mismo' },
          ].map(k => (
            <div key={k.label} className="card dash-kpi">
              <div className="dk-label">{k.label}</div>
              <div className={'dk-val'+(k.accent?' accent':'')}>{k.value}</div>
              {k.sub && <div className="dk-sub">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Selector de período para las 3 métricas */}
        <div className="dash-period-row">
          <span className="dash-period-label">Período para métricas</span>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        <div className="dash-grid">

          {/* ---- Top productos ---- */}
          <div className="card dash-section">
            <div className="dash-section-title">🍔 Top productos</div>
            {topProducts.length === 0
              ? <div className="dash-empty">Sin datos para el período</div>
              : topProducts.slice(0, 8).map((p, i) => (
                <HBar
                  key={p.product_name}
                  label={`#${i+1} ${p.product_name}`}
                  value={parseInt(p.qty)}
                  max={maxProd}
                  color="var(--accent)"
                  sub={`${p.qty} unid · $${Number(p.revenue).toLocaleString('es-AR')}`}
                />
              ))}
          </div>

          {/* ---- Por método de pago ---- */}
          <div className="card dash-section">
            <div className="dash-section-title">💳 Métodos de pago</div>
            {byMethod.length === 0
              ? <div className="dash-empty">Sin cobros en el período</div>
              : (
                <>
                  <div className="dash-method-total">
                    Total: <strong>${totalMethod.toLocaleString('es-AR')}</strong>
                  </div>
                  {byMethod.map(m => {
                    const pct = totalMethod > 0 ? ((parseFloat(m.total)/totalMethod)*100).toFixed(0) : 0
                    return (
                      <div key={m.method} className="method-row">
                        <div className="method-icon-label">
                          <span>{METHOD_ICON[m.method] || '💰'}</span>
                          <span className="method-name">{METHOD_LABEL[m.method] || m.method}</span>
                          <span className="method-count">{m.count} cobros</span>
                        </div>
                        <div className="method-bar-wrap">
                          <div className="method-bar-fill" style={{ width:`${pct}%`, background: METHOD_COLOR[m.method] || 'var(--accent)' }} />
                        </div>
                        <div className="method-vals">
                          <span className="method-total">${Number(m.total).toLocaleString('es-AR')}</span>
                          <span className="method-pct">{pct}%</span>
                        </div>
                        {parseFloat(m.tips) > 0 && (
                          <div className="method-tips">+ ${Number(m.tips).toLocaleString('es-AR')} propinas</div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
          </div>

          {/* ---- Rendimiento por mozo ---- */}
          <div className="card dash-section">
            <div className="dash-section-title">👤 Rendimiento por mozo</div>
            {byWaiter.length === 0
              ? <div className="dash-empty">Sin actividad en el período</div>
              : byWaiter.map((w, i) => (
                <div key={w.id} className="waiter-row">
                  <div className="waiter-rank">#{i+1}</div>
                  <div className="waiter-avatar">{w.avatar_initials || w.name[0]}</div>
                  <div className="waiter-info">
                    <div className="waiter-name">{w.name}</div>
                    <div className="waiter-bar-wrap">
                      <div className="waiter-bar-fill" style={{ width:`${(parseFloat(w.total_sales)/maxWaiter*100)}%` }} />
                    </div>
                    <div className="waiter-stats">
                      <span>{w.billed_orders} pedidos</span>
                      {w.cancelled_orders > 0 && <span className="waiter-cancelled">{w.cancelled_orders} cancel.</span>}
                      <span>prom. ${Math.round(parseFloat(w.avg_ticket)).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                  <div className="waiter-total">${Number(w.total_sales).toLocaleString('es-AR')}</div>
                </div>
              ))}
          </div>

          {/* ---- Estado en tiempo real ---- */}
          <div className="card dash-section">
            <div className="dash-section-title">⚡ En tiempo real</div>
            {['pending','confirmed','in_kitchen','ready','delivered'].map(s => {
              const count = liveOrders.filter(o => o.status === s).length
              return (
                <div key={s} className="live-row">
                  <div className="live-dot" style={{ background: STATUS_COLORS[s] }} />
                  <div className="live-label">{STATUS_LABEL[s]}</div>
                  <div className="live-count" style={{ color: STATUS_COLORS[s] }}>{count}</div>
                </div>
              )
            })}
            {liveOrders.length === 0 && <div className="dash-empty">Sin pedidos activos</div>}
          </div>

        </div>
      </div>
    </Layout>
  )
}

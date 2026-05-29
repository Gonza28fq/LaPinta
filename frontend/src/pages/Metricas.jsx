import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/layout/Layout'
import { metricsAPI } from '../services/api'
import api from '../services/api'
import * as XLSX from 'xlsx'
import './Metricas.css'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const METHOD_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', qr:'QR' }
const METHOD_COLOR = { cash:'#4a9a4a', card:'#4a80c8', transfer:'#9a4ac8', qr:'#C8A96A' }

// ---- Componentes de gráficos ----
function BarChartV({ data, valueKey, labelKey, color, height = 140, formatVal }) {
  const max = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 1)
  return (
    <div className="bcv-wrap" style={{ height }}>
      <div className="bcv-bars">
        {data.map((d, i) => {
          const val = parseFloat(d[valueKey]) || 0
          const pct = (val / max) * 100
          return (
            <div key={i} className="bcv-col">
              <div className="bcv-val">{val > 0 ? (formatVal ? formatVal(val) : val) : ''}</div>
              <div className="bcv-bar-wrap">
                <div className="bcv-bar-fill" style={{ height: `${pct}%`, background: color || 'var(--accent)' }} />
              </div>
              <div className="bcv-label">{d[labelKey]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HBarChart({ data, valueKey, labelKey, color, formatVal, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 1)
  return (
    <div className="hbc-list">
      {data.map((d, i) => {
        const val = parseFloat(d[valueKey]) || 0
        const pct = (val / max) * 100
        return (
          <div key={i} className="hbc-row">
            <div className="hbc-label">{d[labelKey]}</div>
            <div className="hbc-track">
              <div className="hbc-fill" style={{ width: `${pct}%`, background: color || 'var(--accent)' }} />
            </div>
            <div className="hbc-val">{formatVal ? formatVal(val) : val}</div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data, totalKey, labelKey, colorMap }) {
  const total = data.reduce((s, d) => s + parseFloat(d[totalKey] || 0), 0)
  let cumAngle = -90
  const cx = 60, cy = 60, r = 50, stroke = 18

  const slices = data.map((d, i) => {
    const val   = parseFloat(d[totalKey] || 0)
    const angle = total > 0 ? (val / total) * 360 : 0
    const startAngle = cumAngle
    cumAngle += angle
    const startRad = (startAngle * Math.PI) / 180
    const endRad   = ((startAngle + angle) * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const large = angle > 180 ? 1 : 0
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, val, angle, color: colorMap?.[d[labelKey]] || 'var(--accent)' }
  })

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {slices.map((s, i) => s.angle > 0 && (
          <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        <text x="60" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
          ${(total/1000).toFixed(0)}k
        </text>
        <text x="60" y="70" textAnchor="middle" fill="var(--text-muted)" fontSize="8">total</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={i} className="donut-legend-row">
            <div className="donut-legend-dot" style={{ background: colorMap?.[d[labelKey]] || 'var(--accent)' }} />
            <span className="donut-legend-label">{METHOD_LABEL[d[labelKey]] || d[labelKey]}</span>
            <span className="donut-legend-val">${Number(d[totalKey]).toLocaleString('es-AR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Exportar a Excel ----
function exportExcel({ monthly, topProducts, byMethod, byWaiter, period }) {
  const wb = XLSX.utils.book_new()

  // Hoja 1: Ventas diarias
  const wsVentas = XLSX.utils.json_to_sheet(monthly.map(r => ({
    'Fecha':    new Date(r.day).toLocaleDateString('es-AR'),
    'Pedidos':  parseInt(r.orders),
    'Recaudado': parseFloat(r.revenue),
  })))
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas diarias')

  // Hoja 2: Top productos
  const wsProductos = XLSX.utils.json_to_sheet(topProducts.map((p, i) => ({
    'Posición':    i + 1,
    'Producto':    p.product_name,
    'Unidades':    parseInt(p.qty),
    'Recaudación': parseFloat(p.revenue),
    'Precio prom': parseFloat(p.avg_price || 0).toFixed(0),
    'Pedidos':     parseInt(p.orders_count),
  })))
  XLSX.utils.book_append_sheet(wb, wsProductos, 'Top productos')

  // Hoja 3: Métodos de pago
  const wsMedios = XLSX.utils.json_to_sheet(byMethod.map(m => ({
    'Método':   METHOD_LABEL[m.method] || m.method,
    'Cobros':   parseInt(m.count),
    'Total':    parseFloat(m.total),
    'Propinas': parseFloat(m.tips || 0),
    'Promedio': parseFloat(m.avg || 0).toFixed(0),
  })))
  XLSX.utils.book_append_sheet(wb, wsMedios, 'Métodos de pago')

  // Hoja 4: Rendimiento mozos
  const wsMozos = XLSX.utils.json_to_sheet(byWaiter.map((w, i) => ({
    'Posición':   i + 1,
    'Nombre':     w.name,
    'Pedidos':    parseInt(w.billed_orders),
    'Cancelados': parseInt(w.cancelled_orders),
    'Ventas':     parseFloat(w.total_sales),
    'Ticket prom':parseFloat(w.avg_ticket || 0).toFixed(0),
  })))
  XLSX.utils.book_append_sheet(wb, wsMozos, 'Rendimiento mozos')

  const fname = `LaPinta_Reporte_${period.from}_${period.to}.xlsx`
  XLSX.writeFile(wb, fname)
}

// ---- Página principal ----
export default function Metricas() {
  const now  = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [today] = useState(now.toISOString().split('T')[0])

  const getMonthStart = () => {
    const d = new Date(year, month - 1, 1)
    return d.toISOString().split('T')[0]
  }
  const getMonthEnd = () => {
    const d = new Date(year, month, 0)
    return d.toISOString().split('T')[0]
  }

  const [daily,       setDaily]       = useState(null)
  const [monthly,     setMonthly]     = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [byMethod,    setByMethod]    = useState([])
  const [byWaiter,    setByWaiter]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('ventas')

  const period = { from: getMonthStart(), to: getMonthEnd() }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, m, prods, methods, waiters] = await Promise.all([
        metricsAPI.getSummary(today),
        metricsAPI.getMonthly(month, year),
        api.get('/metrics/top-products', { params: { from: period.from, to: period.to, limit: 10 } }).then(r => r.data || r),
        api.get('/metrics/by-method',    { params: { from: period.from, to: period.to } }).then(r => r.data || r),
        api.get('/metrics/by-waiter',    { params: { from: period.from, to: period.to } }).then(r => r.data || r),
      ])
      setDaily(d)
      setMonthly(m.map(r => ({
        ...r,
        label:   new Date(r.day).getDate() + '/' + (new Date(r.day).getMonth() + 1),
        revenue: parseFloat(r.revenue),
        orders:  parseInt(r.orders),
      })))
      setTopProducts(prods)
      setByMethod(methods)
      setByWaiter(waiters)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [month, year])

  useEffect(() => { load() }, [load])

  const totalMonth  = monthly.reduce((s, d) => s + d.revenue, 0)
  const totalOrders = monthly.reduce((s, d) => s + d.orders, 0)
  const avgDaily    = monthly.length > 0 ? totalMonth / monthly.length : 0
  const maxRevDay   = Math.max(...monthly.map(d => d.revenue), 1)

  const handleExport = () => {
    exportExcel({ monthly, topProducts, byMethod, byWaiter, period })
  }

  return (
    <Layout>
      <div className="met-page">

        {/* Header */}
        <div className="met-header">
          <div>
            <h1 className="met-title">Métricas y Reportes</h1>
            <p className="met-subtitle">Análisis de ventas y rendimiento</p>
          </div>
          <div className="met-header-actions">
            <div className="met-period-sel">
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
                {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary met-export-btn" onClick={handleExport} disabled={loading}>
              ⬇ Exportar Excel
            </button>
          </div>
        </div>

        {/* KPIs del día */}
        <div className="met-section-label">Hoy · {new Date(today+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div className="met-kpis">
          {[
            { label:'Recaudado', val:`$${parseFloat(daily?.revenue?.total||0).toLocaleString('es-AR')}`, accent:true },
            { label:'Propinas',  val:`$${parseFloat(daily?.revenue?.tips||0).toLocaleString('es-AR')}` },
            { label:'Ticket prom', val:`$${Math.round(parseFloat(daily?.avgTicket?.avg||0)).toLocaleString('es-AR')}` },
            { label:'Cobrados hoy', val: daily?.orders?.find(o=>o.status==='billed')?.total||0 },
          ].map(k => (
            <div key={k.label} className="card met-kpi">
              <div className="met-kpi-label">{k.label}</div>
              <div className={'met-kpi-val'+(k.accent?' accent':'')}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* KPIs del mes */}
        <div className="met-section-label" style={{marginTop:16}}>
          {MONTHS[month-1]} {year}
          <span className="met-section-sub"> · {totalOrders} pedidos · ${Math.round(avgDaily).toLocaleString('es-AR')} promedio diario</span>
        </div>
        <div className="met-kpis" style={{marginBottom:16}}>
          <div className="card met-kpi">
            <div className="met-kpi-label">Recaudación del mes</div>
            <div className="met-kpi-val accent">${totalMonth.toLocaleString('es-AR')}</div>
          </div>
          <div className="card met-kpi">
            <div className="met-kpi-label">Total pedidos</div>
            <div className="met-kpi-val">{totalOrders}</div>
          </div>
          <div className="card met-kpi">
            <div className="met-kpi-label">Promedio diario</div>
            <div className="met-kpi-val">${Math.round(avgDaily).toLocaleString('es-AR')}</div>
          </div>
          <div className="card met-kpi">
            <div className="met-kpi-label">Mejor día</div>
            <div className="met-kpi-val">${Math.max(...monthly.map(d=>d.revenue),0).toLocaleString('es-AR')}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="met-tabs">
          {[
            { key:'ventas',    label:'📈 Ventas' },
            { key:'productos', label:'🍔 Productos' },
            { key:'pagos',     label:'💳 Métodos de pago' },
            { key:'mozos',     label:'👤 Mozos' },
          ].map(t => (
            <button key={t.key} className={'met-tab'+(activeTab===t.key?' active':'')} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="met-loading">Calculando métricas...</div>
        ) : (

          activeTab === 'ventas' ? (
            <div className="met-tab-content">
              <div className="card met-chart-card">
                <div className="met-chart-title">Recaudación diaria — {MONTHS[month-1]} {year}</div>
                {monthly.length > 0
                  ? <BarChartV data={monthly} valueKey="revenue" labelKey="label" color="var(--accent)" height={160}
                      formatVal={v => `$${Math.round(v/1000)}k`} />
                  : <div className="met-empty">Sin datos para este mes</div>}
              </div>
              <div className="card met-chart-card" style={{marginTop:12}}>
                <div className="met-chart-title">Pedidos por día — {MONTHS[month-1]} {year}</div>
                {monthly.length > 0
                  ? <BarChartV data={monthly} valueKey="orders" labelKey="label" color="var(--order-confirmed)" height={120} />
                  : <div className="met-empty">Sin datos</div>}
              </div>
            </div>

          ) : activeTab === 'productos' ? (
            <div className="met-tab-content">
              <div className="card met-chart-card">
                <div className="met-chart-title">Top productos por unidades vendidas</div>
                {topProducts.length === 0
                  ? <div className="met-empty">Sin ventas en el período</div>
                  : <HBarChart data={topProducts.slice(0,10)} valueKey="qty" labelKey="product_name"
                      color="var(--accent)" formatVal={v => `${v} unid`} />}
              </div>
              <div className="card met-chart-card" style={{marginTop:12}}>
                <div className="met-chart-title">Top productos por recaudación</div>
                {topProducts.length === 0
                  ? <div className="met-empty">Sin ventas en el período</div>
                  : <HBarChart data={[...topProducts].sort((a,b)=>b.revenue-a.revenue).slice(0,10)}
                      valueKey="revenue" labelKey="product_name" color="var(--order-ready)"
                      formatVal={v => `$${Number(v).toLocaleString('es-AR')}`} />}
              </div>
              {topProducts.length > 0 && (
                <div className="card" style={{marginTop:12, padding:0, overflow:'hidden'}}>
                  <div className="met-chart-title" style={{padding:'14px 16px 0'}}>Detalle completo</div>
                  <table className="met-table">
                    <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Recaudación</th><th>Precio prom</th><th>Pedidos</th></tr></thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={p.product_name}>
                          <td className="met-td-muted">#{i+1}</td>
                          <td className="met-td-name">{p.product_name}</td>
                          <td><strong>{p.qty}</strong></td>
                          <td className="met-td-accent">${Number(p.revenue).toLocaleString('es-AR')}</td>
                          <td className="met-td-muted">${Math.round(parseFloat(p.avg_price||0)).toLocaleString('es-AR')}</td>
                          <td className="met-td-muted">{p.orders_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          ) : activeTab === 'pagos' ? (
            <div className="met-tab-content">
              {byMethod.length === 0
                ? <div className="card met-empty">Sin cobros en el período</div>
                : (
                  <div className="met-pagos-grid">
                    <div className="card met-chart-card">
                      <div className="met-chart-title">Distribución por método</div>
                      <DonutChart data={byMethod} totalKey="total" labelKey="method" colorMap={METHOD_COLOR} />
                    </div>
                    <div className="card met-chart-card">
                      <div className="met-chart-title">Detalle por método</div>
                      <table className="met-table">
                        <thead><tr><th>Método</th><th>Cobros</th><th>Total</th><th>Propinas</th><th>Promedio</th></tr></thead>
                        <tbody>
                          {byMethod.map(m => (
                            <tr key={m.method}>
                              <td><span className="met-method-dot" style={{background: METHOD_COLOR[m.method]||'var(--accent)'}}/>{METHOD_LABEL[m.method]||m.method}</td>
                              <td>{m.count}</td>
                              <td className="met-td-accent">${Number(m.total).toLocaleString('es-AR')}</td>
                              <td className="met-td-muted">{m.tips>0?`$${Number(m.tips).toLocaleString('es-AR')}`:'—'}</td>
                              <td className="met-td-muted">${Math.round(parseFloat(m.avg||0)).toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>

          ) : (
            <div className="met-tab-content">
              {byWaiter.length === 0
                ? <div className="card met-empty">Sin actividad en el período</div>
                : (
                  <>
                    <div className="card met-chart-card">
                      <div className="met-chart-title">Ventas por mozo</div>
                      <HBarChart
                        data={byWaiter} valueKey="total_sales" labelKey="name"
                        color="var(--accent)"
                        formatVal={v => `$${Number(v).toLocaleString('es-AR')}`}
                      />
                    </div>
                    <div className="card" style={{marginTop:12, padding:0, overflow:'hidden'}}>
                      <div className="met-chart-title" style={{padding:'14px 16px 0'}}>Ranking completo</div>
                      <table className="met-table">
                        <thead><tr><th>#</th><th>Mozo</th><th>Pedidos</th><th>Cancelados</th><th>Ventas</th><th>Ticket prom</th></tr></thead>
                        <tbody>
                          {byWaiter.map((w, i) => (
                            <tr key={w.id}>
                              <td className="met-td-muted">#{i+1}</td>
                              <td>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <div className="met-waiter-avatar">{w.avatar_initials||w.name[0]}</div>
                                  {w.name}
                                </div>
                              </td>
                              <td><strong>{w.billed_orders}</strong></td>
                              <td style={{color: w.cancelled_orders>0?'var(--danger)':'var(--text-muted)'}}>{w.cancelled_orders}</td>
                              <td className="met-td-accent">${Number(w.total_sales).toLocaleString('es-AR')}</td>
                              <td className="met-td-muted">${Math.round(parseFloat(w.avg_ticket||0)).toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </div>
          )
        )}
      </div>
    </Layout>
  )
}
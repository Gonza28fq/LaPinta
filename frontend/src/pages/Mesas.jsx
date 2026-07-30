import { useState, useRef, useCallback, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { tablesAPI, ordersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import NuevoPedidoModal from '../components/pedidos/NuevoPedidoModal'
import toast from 'react-hot-toast'
import './Mesas.css'

const STATUS_COLOR = {
  available: '#4a9a4a',
  occupied:  '#c94040',
  reserved:  '#d4a017',
  cleaning:  '#8faec7',
}
const STATUS_LABEL = {
  available: 'Disponible',
  occupied:  'Ocupada',
  reserved:  'Reservada',
  cleaning:  'Limpieza',
}
const ORDER_LABEL = {
  pending:    'Esperando confirmación',
  confirmed:  'Confirmado',
  in_kitchen: 'En cocina',
  ready:      '¡Listo!',
  delivered:  'Entregado',
}

const ZONES = [
  { key: 'patio', label: 'Patio' },
  { key: 'salon', label: 'Salon' },
  { key: 'fondo', label: 'Fondo' },
  { key: 'barra', label: 'Barra' },
]
const zoneLabel = (zone) => ZONES.find(z => z.key === zone)?.label || zone

// ---- Modal: Nueva mesa ----
function NuevaMesaModal({ onClose, onSave, tables }) {
  const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1
  const [form, setForm] = useState({ number: nextNum, capacity: 4, zone: 'salon', shape: 'square' })
  const [saving, setSaving] = useState(false)
  const h = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.number) { toast.error('Número requerido'); return }
    setSaving(true)
    try {
      const t = await tablesAPI.create({ ...form, pos_x: 60, pos_y: 60 })
      onSave(t); toast.success(`Mesa ${t.number} creada`); onClose()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al crear mesa') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mesa-modal">
        <div className="modal-header">
          <h2 className="modal-title">Nueva mesa</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mesa-modal-body">
          <div className="form-grid-2">
            <div className="form-row">
              <label>Número de mesa</label>
              <input type="number" value={form.number} onChange={e => h('number', parseInt(e.target.value))} min="1" />
            </div>
            <div className="form-row">
              <label>Capacidad (personas)</label>
              <input type="number" value={form.capacity} onChange={e => h('capacity', parseInt(e.target.value))} min="1" max="20" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Zona</label>
              <select value={form.zone} onChange={e => h('zone', e.target.value)}>
                {ZONES.map(z => <option key={z.key} value={z.key}>{z.label}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Forma</label>
              <select value={form.shape} onChange={e => h('shape', e.target.value)}>
                <option value="square">Cuadrada</option>
                <option value="round">Redonda</option>
                <option value="rect">Rectangular</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando...' : 'Crear mesa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Componente Mesa individual ----
function MesaCard({ table, selected, onSelect, onDragEnd, isEditMode, onDelete }) {
  const dragStart = useRef(null)
  const isDragging = useRef(false)

  const handlePointerDown = (e) => {
    if (!isEditMode) return
    e.preventDefault()
    isDragging.current = false
    dragStart.current = { mx: e.clientX, my: e.clientY, px: table.pos_x, py: table.pos_y }

    const onMove = (me) => {
      const dx = me.clientX - dragStart.current.mx
      const dy = me.clientY - dragStart.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true
      const el = document.getElementById('mesa-' + table.id)
      if (el) { el.style.left = Math.max(0, dragStart.current.px + dx) + 'px'; el.style.top = Math.max(0, dragStart.current.py + dy) + 'px' }
    }
    const onUp = (me) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      if (isDragging.current) {
        const dx = me.clientX - dragStart.current.mx
        const dy = me.clientY - dragStart.current.my
        onDragEnd(table.id, Math.max(0, dragStart.current.px + dx), Math.max(0, dragStart.current.py + dy))
      } else {
        onSelect(table)
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  const handleClick = () => {
    if (!isEditMode && !isDragging.current) onSelect(table)
  }

  const w = table.shape === 'rect' ? 110 : 80
  const h = 80
  const radius = table.shape === 'round' ? '50%' : '10px'
  const color = STATUS_COLOR[table.status] || '#4a9a4a'
  const isSelected = selected?.id === table.id

  return (
    <div
      id={'mesa-' + table.id}
      className={'mesa-item' + (isSelected ? ' selected' : '') + (isEditMode ? ' editable' : '')}
      style={{ left: table.pos_x, top: table.pos_y, width: w, height: h, borderRadius: radius, borderColor: isSelected ? 'var(--accent)' : color + '66', boxShadow: isSelected ? '0 0 0 2px var(--accent)' : 'none' }}
      onPointerDown={isEditMode ? handlePointerDown : undefined}
      onClick={!isEditMode ? handleClick : undefined}
    >
      {/* Dot de estado */}
      <div className="mesa-dot" style={{ background: color }} />

      {/* Número */}
      <div className="mesa-num">{table.number}</div>

      {/* Info */}
      <div className="mesa-cap">{table.capacity}p</div>

      {/* Estado del pedido */}
      {table.status === 'occupied' && table.order_status && (
        <div className="mesa-order-pill" style={{ background: 'rgba(0,0,0,.45)', fontSize: 9 }}>
          {ORDER_LABEL[table.order_status] || table.order_status}
        </div>
      )}

      {/* Botón eliminar en modo edición */}
      {isEditMode && (
        <button className="mesa-delete-btn" onClick={e => { e.stopPropagation(); onDelete(table) }} title="Eliminar mesa">✕</button>
      )}
    </div>
  )
}

// ---- Panel lateral de mesa seleccionada ----
function MesaPanel({ table, onClose, onAction, onUpdateStatus }) {
  const { canTakeOrders, isManager } = useAuth()
  const [pedidoModal, setPedidoModal] = useState(false)

  if (!table) return null
  const color = STATUS_COLOR[table.status]

  return (
    <>
      <div className="mesa-panel">
        <div className="mp-header">
          <div>
            <div className="mp-title">Mesa {table.number}</div>
            <div className="mp-zone">{zoneLabel(table.zone)} · {table.capacity} personas</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="mp-status" style={{ borderColor: color + '44', background: color + '11' }}>
          <div className="mp-status-dot" style={{ background: color }} />
          <span style={{ color }}>{STATUS_LABEL[table.status]}</span>
        </div>

        {table.status === 'occupied' && table.active_order_id && (
          <div className="mp-order">
            {table.customer_name && <div className="mp-customer">{table.customer_name}</div>}
            {table.order_status && <div className="mp-order-status">{ORDER_LABEL[table.order_status]}</div>}
            {table.waiter_name && <div className="mp-waiter">Mozo: {table.waiter_name}</div>}
            {table.order_total > 0 && <div className="mp-total">${Number(table.order_total).toLocaleString('es-AR')}</div>}
          </div>
        )}

        <div className="mp-actions">
          {table.status === 'available' && canTakeOrders && (
            <button className="btn btn-primary mp-btn" onClick={() => setPedidoModal(true)}>+ Nuevo pedido</button>
          )}
          {table.status === 'occupied' && table.active_order_id && canTakeOrders && (
            <button className="btn btn-primary mp-btn" onClick={() => setPedidoModal(true)}>Editar pedido / agregar consumos</button>
          )}
          {isManager && table.status === 'available' && (
            <button className="btn btn-ghost mp-btn" onClick={() => onUpdateStatus(table.id, 'reserved')}>Reservar</button>
          )}
          {isManager && table.status === 'reserved' && (
            <button className="btn btn-ghost mp-btn" onClick={() => onUpdateStatus(table.id, 'available')}>Cancelar reserva</button>
          )}
          {isManager && table.status === 'occupied' && (
            <button className="btn btn-ghost mp-btn" onClick={() => onUpdateStatus(table.id, 'cleaning')}>Pasar a limpieza</button>
          )}
          {isManager && table.status === 'cleaning' && (
            <button className="btn btn-ghost mp-btn" onClick={() => onUpdateStatus(table.id, 'available')}>Marcar disponible</button>
          )}
        </div>
      </div>

      {pedidoModal && (
        <NuevoPedidoModal
          table={table}
          existingOrder={table.active_order_id ? { id: table.active_order_id, customer_name: table.customer_name } : null}
          onClose={() => { setPedidoModal(false); onClose() }}
        />
      )}
    </>
  )
}

// ---- Página principal ----
export default function Mesas() {
  const { isManager } = useAuth()
  const { socket } = useSocket()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showNewMesa, setShowNewMesa] = useState(false)
  const [filterZone, setFilterZone] = useState('all')
  const saveTimer = useRef(null)

  const loadTables = useCallback(async () => {
    try { setTables(await tablesAPI.getAll()) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTables() }, [loadTables])

  // Socket en tiempo real
  useEffect(() => {
    if (!socket) return
    const upd = u => setTables(p => p.map(t => t.id === u.id ? { ...t, ...u } : t))
    const newOrd = o => {
      if (!o.table_id) return
      setTables(p => p.map(t => t.id === o.table_id ? { ...t, status: 'occupied', active_order_id: o.id, order_status: o.status, waiter_name: o.waiter_name, customer_name: o.customer_name } : t))
    }
    const free = ({ tableId }) => setTables(p => p.map(t => t.id === tableId ? { ...t, status: 'available', active_order_id: null, order_status: null, order_total: null } : t))
    const reload = () => loadTables()
    socket.on('table:status_changed', upd)
    socket.on('order:new', newOrd)
    socket.on('order:updated', reload)
    socket.on('order:payment', reload)
    socket.on('table:available', free)
    return () => {
      socket.off('table:status_changed', upd)
      socket.off('order:new', newOrd)
      socket.off('order:updated', reload)
      socket.off('order:payment', reload)
      socket.off('table:available', free)
    }
  }, [socket, loadTables])

  const handleDragEnd = useCallback((id, x, y) => {
    setTables(p => p.map(t => t.id === id ? { ...t, pos_x: x, pos_y: y } : t))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      tablesAPI.updatePosition(id, x, y).catch(() => toast.error('Error al guardar posición'))
    }, 600)
  }, [])

  const handleUpdateStatus = async (id, status) => {
    try {
      await tablesAPI.updateStatus(id, status)
      setTables(p => p.map(t => t.id === id ? { ...t, status } : t))
      setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
    } catch { toast.error('Error al actualizar estado') }
  }

  const handleDelete = async (table) => {
    if (!window.confirm(`¿Eliminar mesa ${table.number}?`)) return
    try {
      await tablesAPI.delete(table.id)
      setTables(p => p.filter(t => t.id !== table.id))
      toast.success(`Mesa ${table.number} eliminada`)
    } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar') }
  }

  const zones = ['all', ...ZONES.map(z => z.key)]
  const filtered = filterZone === 'all' ? tables : tables.filter(t => t.zone === filterZone)

  const stats = {
    available: tables.filter(t => t.status === 'available').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
    total:     tables.length,
  }

  return (
    <Layout>
      <div className="mesas-page">
        {/* Header */}
        <div className="mesas-header">
          <div>
            <h1 className="mesas-title">Mesas</h1>
            <p className="mesas-subtitle">
              <span className="stat-pill available">{stats.available} disponibles</span>
              <span className="stat-pill occupied">{stats.occupied} ocupadas</span>
              {stats.reserved > 0 && <span className="stat-pill reserved">{stats.reserved} reservadas</span>}
              <span className="stat-pill total">{stats.total} total</span>
            </p>
          </div>
          <div className="mesas-toolbar">
            <div className="zone-filters">
              {zones.map(z => (
                <button key={z} className={'zone-btn' + (filterZone === z ? ' active' : '')} onClick={() => setFilterZone(z)}>
                  {z === 'all' ? 'Todas' : zoneLabel(z)}
                </button>
              ))}
            </div>
            {isManager && (
              <div className="mesas-actions">
                <button
                  className={'btn ' + (isEditMode ? 'btn-primary' : 'btn-ghost') + ' edit-btn'}
                  onClick={() => { setIsEditMode(e => !e); setSelected(null) }}
                >
                  {isEditMode ? '✓ Guardar disposición' : '✏ Editar plano'}
                </button>
                <button className="btn btn-primary" onClick={() => setShowNewMesa(true)}>+ Mesa</button>
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mesas-legend">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="legend-item">
              <div className="legend-dot" style={{ background: c }} />
              <span>{STATUS_LABEL[s]}</span>
            </div>
          ))}
          {isEditMode && <div className="legend-edit-hint">✏ Arrastrá las mesas para reposicionarlas</div>}
        </div>

        {/* Plano */}
        <div className="mesas-layout-wrap">
          {loading ? (
            <div className="mesas-loading">Cargando mesas...</div>
          ) : (
            <div className={'mesas-canvas' + (isEditMode ? ' edit-mode' : '')}>
              {filtered.length === 0 && (
                <div className="mesas-empty">
                  {filterZone !== 'all' ? `No hay mesas en ${filterZone}` : 'No hay mesas. Creá la primera con el botón + Mesa'}
                </div>
              )}
              {filtered.map(table => (
                <MesaCard
                  key={table.id}
                  table={table}
                  selected={selected}
                  onSelect={t => setSelected(prev => prev?.id === t.id ? null : t)}
                  onDragEnd={handleDragEnd}
                  isEditMode={isEditMode}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Panel lateral */}
          {selected && !isEditMode && (
            <MesaPanel
              table={selected}
              onClose={() => setSelected(null)}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </div>
      </div>

      {showNewMesa && (
        <NuevaMesaModal
          tables={tables}
          onClose={() => setShowNewMesa(false)}
          onSave={t => setTables(p => [...p, t])}
        />
      )}
    </Layout>
  )
}

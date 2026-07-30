import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { productsAPI, cartaAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Productos.css'

const CATEGORIES = [
  { key:'all',      label:'Todos' },
  { key:'burger',   label:'Burgers' },
  { key:'sandwich', label:'Sandwiches' },
  { key:'pizza',    label:'Pizzas' },
  { key:'papas',    label:'Papas fritas' },
  { key:'bebida',   label:'Bebidas' },
  { key:'trago',    label:'Tragos' },
  { key:'postre',   label:'Postres' },
  { key:'extra',    label:'Extras' },
  { key:'otro',     label:'Otros' },
]

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product || {
    name:'', description:'', category:'burger',
    current_price:'', cost_price:'', is_featured:false,
  })
  const [saving, setSaving] = useState(false)

  const handle = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.current_price) { toast.error('Nombre y precio son requeridos'); return }
    setSaving(true)
    try {
      const data = product
        ? await productsAPI.update(product.id, form)
        : await productsAPI.create(form)
      onSave(data)
      toast.success(product ? 'Producto actualizado' : 'Producto creado')
      onClose()
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="product-modal">
        <div className="modal-header">
          <h2 className="modal-title">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="product-modal-body">
          <div className="form-row">
            <label>Nombre</label>
            <input value={form.name} onChange={e => handle('name', e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div className="form-row">
            <label>Descripción</label>
            <textarea rows={2} value={form.description||''} onChange={e => handle('description', e.target.value)} placeholder="Ingredientes, descripción..." />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Categoría</label>
              <select value={form.category} onChange={e => handle('category', e.target.value)}>
                {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Destacado</label>
              <div className="toggle-row">
                <input type="checkbox" checked={form.is_featured||false} onChange={e => handle('is_featured', e.target.checked)} id="featured" />
                <label htmlFor="featured" className="toggle-label">Mostrar destacado en carta</label>
              </div>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Precio de venta ($)</label>
              <input type="number" value={form.current_price||''} onChange={e => handle('current_price', e.target.value)} placeholder="0" />
            </div>
            <div className="form-row">
              <label>Costo ($)</label>
              <input type="number" value={form.cost_price||''} onChange={e => handle('cost_price', e.target.value)} placeholder="0" />
            </div>
          </div>
          {form.current_price && form.cost_price && (
            <div className="margin-preview">
              Margen: {(((form.current_price - form.cost_price) / form.current_price) * 100).toFixed(1)}%
              &nbsp;·&nbsp; Ganancia: ${(form.current_price - form.cost_price).toLocaleString('es-AR')}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AjusteModal({ onClose, onApply }) {
  const [pct, setPct] = useState('')
  const [category, setCategory] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const handleApply = async () => {
    if (!pct || pct <= 0) { toast.error('Ingresá un porcentaje válido'); return }
    if (!window.confirm(`¿Ajustar precios un ${pct}%? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    try {
      const res = await productsAPI.adjustPrices({ percentage: parseFloat(pct), category: category||undefined, description: desc })
      toast.success(res.message)
      onApply()
      onClose()
    } catch { toast.error('Error al ajustar precios') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ajuste-modal">
        <div className="modal-header">
          <h2 className="modal-title">Ajuste de precios por inflación</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="product-modal-body">
          <div className="ajuste-warning">
            ⚠ Esta operación modifica los precios de venta de los productos seleccionados y queda registrada en el historial.
          </div>
          <div className="form-row">
            <label>Porcentaje de aumento (%)</label>
            <input type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="Ej: 15" min="0.1" step="0.1" />
          </div>
          <div className="form-row">
            <label>Categoría (opcional — vacío = todos los productos)</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Todos los productos</option>
              {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Motivo del ajuste</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Actualización julio 2025" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={saving} style={{background:'var(--warning)',color:'#fff'}}>
            {saving ? 'Aplicando...' : `Aplicar +${pct||0}%`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Productos() {
  const { isOwner, isManager } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showAjuste, setShowAjuste] = useState(false)

  const loadProducts = async () => {
    setLoading(true)
    try { setProducts(await productsAPI.getAll()) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadProducts() }, [])

  const filtered = products
    .filter(p => category === 'all' || p.category === category)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const handleToggle = async (product) => {
    try {
      const updated = await productsAPI.toggleAvailability(product.id)
      setProducts(prev => prev.map(p => p.id === product.id ? updated : p))
    } catch { toast.error('Error al cambiar disponibilidad') }
  }

  const handleSave = (saved) => {
    setProducts(prev => {
      const exists = prev.find(p => p.id === saved.id)
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    })
  }

  const canEdit = isOwner || isManager

  return (
    <Layout>
      <div className="productos-page">
        <div className="productos-header">
          <div>
            <h1 className="productos-title">Carta y productos</h1>
            <p className="productos-subtitle">{products.length} productos · {products.filter(p=>p.is_available).length} disponibles</p>
          </div>
          {canEdit && (
            <div className="productos-actions">
              <button className="btn btn-ghost" onClick={() => window.open(cartaAPI.pdfUrl(), '_blank')}>Ver carta PDF</button>
              <button className="btn btn-ghost" onClick={() => window.open(cartaAPI.pdfUrl('bebidas'), '_blank')}>Carta bebidas PDF</button>
              <button className="btn btn-ghost" onClick={() => window.open(cartaAPI.pdfUrl('tragos'), '_blank')}>Carta tragos PDF</button>
              <button className="btn btn-ghost" onClick={() => setShowAjuste(true)}>Ajuste inflacion</button>
              <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>+ Producto</button>
            </div>
          )}
        </div>

        <div className="productos-toolbar">
          <input
            className="productos-search"
            placeholder="Buscar producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="cat-filters">
            {CATEGORIES.map(c => (
              <button key={c.key} className={`cat-btn ${category === c.key ? 'active' : ''}`} onClick={() => setCategory(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="productos-loading">Cargando carta...</div>
        ) : (
          <div className="productos-table-wrap">
            <table className="productos-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Costo</th>
                  <th>Margen</th>
                  <th>Estado</th>
                  {canEdit && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const margin = p.cost_price ? (((p.current_price - p.cost_price) / p.current_price) * 100).toFixed(0) : null
                  return (
                    <tr key={p.id} className={!p.is_available ? 'row-disabled' : ''}>
                      <td>
                        <div className="prod-name">{p.name}{p.is_featured && <span className="prod-featured">★</span>}</div>
                        {p.description && <div className="prod-desc">{p.description}</div>}
                      </td>
                      <td><span className="prod-category">{CATEGORIES.find(c=>c.key===p.category)?.label || p.category}</span></td>
                      <td className="prod-price">${Number(p.current_price).toLocaleString('es-AR')}</td>
                      <td className="prod-cost">{p.cost_price ? `$${Number(p.cost_price).toLocaleString('es-AR')}` : '—'}</td>
                      <td>
                        {margin ? (
                          <span className={`prod-margin ${parseInt(margin) >= 50 ? 'good' : parseInt(margin) >= 30 ? 'mid' : 'low'}`}>
                            {margin}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`prod-status ${p.is_available ? 'on' : 'off'}`}>
                          {p.is_available ? 'Disponible' : 'No disponible'}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <div className="prod-actions">
                            <button className="prod-btn" onClick={() => setEditingProduct(p)}>Editar</button>
                            <button className={`prod-btn ${p.is_available ? 'danger' : 'success'}`} onClick={() => handleToggle(p)}>
                              {p.is_available ? 'Ocultar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="productos-empty">No hay productos</div>}
          </div>
        )}
      </div>

      {(showNewModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => { setShowNewModal(false); setEditingProduct(null) }}
          onSave={handleSave}
        />
      )}
      {showAjuste && <AjusteModal onClose={() => setShowAjuste(false)} onApply={loadProducts} />}
    </Layout>
  )
}

import { useState, useEffect, useRef } from 'react'
import { productsAPI, ordersAPI, customersAPI } from '../../services/api'
import toast from 'react-hot-toast'
import './NuevoPedidoModal.css'

const CAT_LABELS = {
  burger:'Burgers', sandwich:'Sandwiches', pizza:'Pizzas',
  papas:'Papas', bebida:'Bebidas', trago:'Tragos', postre:'Postres', extra:'Extras', otro:'Otros'
}
const CAT_ORDER = ['burger','sandwich','pizza','papas','bebida','trago','postre','extra','otro']

// Formatea hora como HH:MM:SS
function useCurrentTime() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ---- Fila de ítem en el resumen ----
function ResumenItem({ item, onRemove, onChangePrice, onChangeQty }) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(item.unit_price)
  const inputRef = useRef(null)

  const handlePriceClick = () => {
    setPriceInput(item.unit_price)
    setEditingPrice(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const handlePriceBlur = () => {
    const val = parseFloat(priceInput)
    if (!isNaN(val) && val >= 0) onChangePrice(item.id || item.product_id || item.custom_id, val)
    setEditingPrice(false)
  }

  const subtotal = item.unit_price * item.quantity

  return (
    <div className="resumen-item-row">
      <div className="ri-qty-ctrl">
        <button className="ri-qty-btn" onClick={() => onChangeQty(item.id || item.product_id || item.custom_id, -1)}>−</button>
        <span className="ri-qty">{item.quantity}</span>
        <button className="ri-qty-btn" onClick={() => onChangeQty(item.id || item.product_id || item.custom_id, 1)}>+</button>
      </div>
      <div className="ri-info">
        <div className="ri-name">
          {item.custom && <span className="ri-custom-badge">✦</span>}
          {item.product_name}
        </div>
        {Number(item.paid_quantity || 0) > 0 && (
          <div className="ri-paid-note">{item.paid_quantity} ya cobrado</div>
        )}
        <div className="ri-price-row">
          {editingPrice ? (
            <input
              ref={inputRef}
              className="ri-price-input"
              type="number"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              onBlur={handlePriceBlur}
              onKeyDown={e => e.key === 'Enter' && handlePriceBlur()}
              min="0"
            />
          ) : (
            <button className="ri-price-btn" onClick={handlePriceClick} title="Tocar para editar precio">
              ${Number(item.unit_price).toLocaleString('es-AR')}
              <span className="ri-edit-icon">✎</span>
            </button>
          )}
          <span className="ri-subtotal">${Number(subtotal).toLocaleString('es-AR')}</span>
        </div>
      </div>
      <button className="ri-remove" onClick={() => onRemove(item.id || item.product_id || item.custom_id)}>✕</button>
    </div>
  )
}

// ---- Modal principal ----
export default function NuevoPedidoModal({ table, existingOrder, onClose }) {
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([])
  const [removedItems, setRemovedItems] = useState([])
  const [customerName, setCustomerName] = useState(existingOrder?.customer_name || '')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerResults, setCustomerResults] = useState([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [notes, setNotes] = useState('')
  const [orderType, setOrderType] = useState(table ? 'mesa' : 'delivery')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [activeCat, setActiveCat] = useState('burger')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [createdAt] = useState(new Date())
  const currentTime = useCurrentTime()

  // Panel de ítem personalizado
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState(1)

  useEffect(() => {
    productsAPI.getAll({ available: true })
      .then(setProducts).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!existingOrder?.id) return
    setLoading(true)
    ordersAPI.getById(existingOrder.id)
      .then(detail => {
        setCustomerName(detail.customer_name || '')
        setNotes(detail.notes || '')
        setItems((detail.items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price: Number(item.unit_price),
          quantity: Number(item.quantity),
          paid_quantity: Number(item.paid_quantity || 0),
          extras: item.extras || [],
          notes: item.notes || '',
          custom: !item.product_id,
        })))
      })
      .catch(() => toast.error('Error al cargar pedido'))
      .finally(() => setLoading(false))
  }, [existingOrder?.id])

  useEffect(() => {
    if (existingOrder) return
    const search = customerName.trim()
    if (selectedCustomer && search === selectedCustomer.name) {
      setCustomerResults([])
      return
    }
    if (search.length < 2) {
      setCustomerResults([])
      return
    }

    let cancelled = false
    setSearchingCustomers(true)
    const id = setTimeout(() => {
      customersAPI.getAll({ search })
        .then(customers => {
          if (!cancelled) setCustomerResults(customers.slice(0, 6))
        })
        .catch(() => {
          if (!cancelled) setCustomerResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchingCustomers(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [customerName, selectedCustomer, existingOrder])

  const cats = [...new Set(products.map(p => p.category))]
    .sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b))
  const filtered = products.filter(p => p.category === activeCat)

  useEffect(() => {
    if (products.length && !products.some(p => p.category === activeCat)) {
      setActiveCat(cats[0] || 'burger')
    }
  }, [products, activeCat, cats])

  // ---- Agregar producto de la carta ----
  const addProduct = (p) => {
    setItems(prev => {
      const ex = prev.find(i => i.product_id === p.id)
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        product_id: p.id, product_name: p.name,
        unit_price: p.current_price, quantity: 1,
        extras: [], notes: '', custom: false
      }]
    })
  }

  // ---- Agregar ítem personalizado ----
  const addCustomItem = () => {
    if (!customName.trim()) { toast.error('Ingresá un nombre'); return }
    const price = parseFloat(customPrice) || 0
    const id = 'custom_' + Date.now()
    setItems(prev => [...prev, {
      custom_id: id, product_id: null,
      product_name: customName.trim(),
      unit_price: price, quantity: parseInt(customQty) || 1,
      extras: [], notes: '', custom: true
    }])
    setCustomName(''); setCustomPrice(''); setCustomQty(1)
    setShowCustom(false)
    toast.success('Ítem agregado')
  }

  // ---- Cambiar precio de un ítem ----
  const handleChangePrice = (id, newPrice) => {
    setItems(prev => prev.map(i =>
      (i.id === id || i.product_id === id || i.custom_id === id)
        ? { ...i, unit_price: newPrice }
        : i
    ))
  }

  // ---- Cambiar cantidad desde el resumen ----
  const handleChangeQty = (id, delta) => {
    setItems(prev => {
      const updated = prev.map(i => {
        if (i.id !== id && i.product_id !== id && i.custom_id !== id) return i
        const newQty = i.quantity + delta
        if (newQty < Number(i.paid_quantity || 0)) {
          toast.error('No se puede bajar de lo ya cobrado')
          return i
        }
        return newQty <= 0 ? null : { ...i, quantity: newQty }
      }).filter(Boolean)
      return updated
    })
  }

  // ---- Eliminar ítem ----
  const removeItem = (id) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id || i.product_id === id || i.custom_id === id)
      if (item?.id && Number(item.paid_quantity || 0) > 0) {
        toast.error('No se puede eliminar un item ya cobrado')
        return prev
      }
      if (item?.id) setRemovedItems(r => [...r, { ...item, quantity: 0 }])
      return prev.filter(i => i.id !== id && i.product_id !== id && i.custom_id !== id)
    })
  }

  // ---- Qty rápida en la carta ----
  const getQty = (pid) => items.find(i => i.product_id === pid)?.quantity || 0

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  const handleCustomerChange = (value) => {
    setCustomerName(value)
    if (selectedCustomer && value !== selectedCustomer.name) setSelectedCustomer(null)
  }

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setCustomerName(customer.name)
    setCustomerResults([])
  }

  // ---- Enviar pedido ----
  const handleSubmit = async () => {
    if (!items.length) { toast.error('Agregá al menos un producto'); return }
    if (!existingOrder && !selectedCustomer?.id) { toast.error('Seleccioná un cliente agendado'); return }
    if (!existingOrder && orderType === 'delivery' && !deliveryAddress.trim()) { toast.error('Ingresá la dirección de entrega'); return }
    setSending(true)
    try {
      const payload = {
        notes,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
          notes: i.notes,
          extras: i.extras,
          custom: i.custom || false,
        }))
      }
      if (existingOrder) {
        const persisted = items.filter(i => i.id).concat(removedItems).map(i => ({
          id: i.id,
          unit_price: i.unit_price,
          quantity: i.quantity,
          notes: i.notes,
        }))
        const created = items.filter(i => !i.id)
        if (persisted.length) await ordersAPI.updateItems(existingOrder.id, { notes, items: persisted })
        if (created.length) {
          await ordersAPI.addItems(existingOrder.id, {
            notes: '',
            items: created.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              unit_price: i.unit_price,
              quantity: i.quantity,
              notes: i.notes,
              extras: i.extras,
              custom: i.custom || false,
            }))
          })
        }
        toast.success('Pedido actualizado - Mesa ' + table.number)
      } else {
        await ordersAPI.create({
          ...payload,
          table_id: table?.id || null,
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          order_type: orderType,
          delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
        })
        toast.success('Pedido enviado — ' + (table ? 'Mesa ' + table.number : 'Delivery'))
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear pedido')
    } finally { setSending(false) }
  }

  const timeStr = currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = createdAt.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="nuevo-pedido-modal">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{existingOrder ? 'Agregar consumos' : 'Nuevo pedido'}</h2>
            <p className="modal-subtitle">{table ? `Mesa ${table.number} · ${table.zone}` : 'Delivery'}</p>
          </div>
          <div className="pedido-timestamp">
            <div className="timestamp-time">{timeStr}</div>
            <div className="timestamp-date">{dateStr}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* ---- Panel izquierdo: carta ---- */}
          <div className="pedido-carta">

            {/* Cliente */}
            <div className="pedido-cliente-field">
              {!existingOrder && (
                <div className="order-type-toggle">
                  <button
                    type="button"
                    className={orderType === 'mesa' ? 'active' : ''}
                    onClick={() => setOrderType('mesa')}
                    disabled={!table}
                  >
                    Mesa
                  </button>
                  <button
                    type="button"
                    className={orderType === 'delivery' ? 'active' : ''}
                    onClick={() => setOrderType('delivery')}
                  >
                    Delivery
                  </button>
                </div>
              )}
              <input
                placeholder="Nombre del cliente / referencia"
                value={customerName}
                onChange={e => handleCustomerChange(e.target.value)}
                disabled={!!existingOrder}
              />
              {!existingOrder && orderType === 'delivery' && (
                <input
                  className="delivery-address-input"
                  placeholder="Dirección de entrega"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                />
              )}
              {(customerResults.length > 0 || searchingCustomers) && (
                <div className="customer-suggestions">
                  {searchingCustomers ? (
                    <div className="customer-suggestion muted">Buscando clientes...</div>
                  ) : customerResults.map(customer => (
                    <button
                      type="button"
                      key={customer.id}
                      className="customer-suggestion"
                      onClick={() => selectCustomer(customer)}
                    >
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.phone || customer.email || 'Cliente agendado'}</small>
                      </span>
                      <em>{customer.visit_count || 0} visitas</em>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="selected-customer-pill">
                  Cliente agendado
                  <button type="button" onClick={() => setSelectedCustomer(null)}>Cambiar</button>
                </div>
              )}
              {!existingOrder && customerName.trim() && !selectedCustomer && !searchingCustomers && (
                <div className="customer-required-note">Seleccioná un cliente agendado de la lista para continuar.</div>
              )}
            </div>

            {/* Categorías */}
            <div className="pedido-categories">
              {cats.map(c => (
                <button
                  key={c}
                  className={'cat-btn' + (activeCat === c ? ' active' : '')}
                  onClick={() => setActiveCat(c)}
                >
                  {CAT_LABELS[c] || c}
                </button>
              ))}
              {/* Botón ítem personalizado */}
              <button
                className={'cat-btn custom-btn' + (showCustom ? ' active' : '')}
                onClick={() => setShowCustom(s => !s)}
                title="Agregar ítem personalizado"
              >
                ✦ Personalizado
              </button>
            </div>

            {/* Panel ítem personalizado */}
            {showCustom && (
              <div className="custom-item-panel">
                <div className="custom-panel-title">Ítem personalizado</div>
                <div className="custom-panel-desc">Usalo para: vasos rotos, envío, agregados especiales, descuentos (precio negativo), etc.</div>
                <div className="custom-fields">
                  <input
                    placeholder="Nombre del ítem (ej: Vaso roto, Delivery, Extra salsa especial)"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="custom-name-input"
                  />
                  <div className="custom-price-row">
                    <div className="custom-field">
                      <label>Precio ($)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                      />
                    </div>
                    <div className="custom-field">
                      <label>Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={customQty}
                        onChange={e => setCustomQty(e.target.value)}
                      />
                    </div>
                    <button className="btn btn-primary custom-add-btn" onClick={addCustomItem}>
                      + Agregar
                    </button>
                  </div>
                </div>
                <div className="custom-examples">
                  <button className="example-chip" onClick={() => { setCustomName('Vaso roto'); setCustomPrice('500') }}>Vaso roto</button>
                  <button className="example-chip" onClick={() => { setCustomName('Envío'); setCustomPrice('1500') }}>Envío</button>
                  <button className="example-chip" onClick={() => { setCustomName('Descuento'); setCustomPrice('-1000') }}>Descuento</button>
                  <button className="example-chip" onClick={() => { setCustomName('Cubiertos'); setCustomPrice('300') }}>Cubiertos</button>
                </div>
              </div>
            )}

            {/* Productos de la carta */}
            {!showCustom && (
              loading ? (
                <div className="pedido-loading">Cargando carta...</div>
              ) : (
                <div className="pedido-products">
                  {filtered.map(p => {
                    const qty = getQty(p.id)
                    return (
                      <div key={p.id} className={'product-row' + (qty > 0 ? ' selected' : '')}>
                        <div className="product-info">
                          <div className="product-name">{p.name}</div>
                          {p.description && <div className="product-desc">{p.description}</div>}
                          <div className="product-price">${Number(p.current_price).toLocaleString('es-AR')}</div>
                        </div>
                        <div className="product-qty-control">
                          {qty > 0 && (
                            <>
                              <button className="qty-btn remove" onClick={() => handleChangeQty(p.id, -1)}>−</button>
                              <span className="qty-num">{qty}</span>
                            </>
                          )}
                          <button className="qty-btn add" onClick={() => addProduct(p)}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>

          {/* ---- Panel derecho: resumen ---- */}
          <div className="pedido-resumen">
            <div className="resumen-header">
              <h3 className="resumen-title">Resumen</h3>
              <div className="resumen-hint">Tocá el precio para editarlo</div>
            </div>

            {items.length === 0 ? (
              <div className="resumen-empty">Seleccioná productos de la carta</div>
            ) : (
              <div className="resumen-items">
                {items.map(item => (
                  <ResumenItem
                    key={item.id || item.product_id || item.custom_id}
                    item={item}
                    onRemove={removeItem}
                    onChangePrice={handleChangePrice}
                    onChangeQty={handleChangeQty}
                  />
                ))}
              </div>
            )}

            <div className="resumen-divider" />

            <div className="resumen-total">
              <span>Total</span>
              <span>${total.toLocaleString('es-AR')}</span>
            </div>

            <textarea
              className="resumen-notes"
              placeholder="Notas del pedido (opcional)..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />

            {/* Timestamp de creación */}
            <div className="resumen-timestamp">
              <span className="ts-label">Hora de carga</span>
              <span className="ts-value">{createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <button
              className="btn btn-primary resumen-submit"
              onClick={handleSubmit}
              disabled={sending || items.length === 0}
            >
              {sending ? 'Enviando...' : 'Enviar · $' + total.toLocaleString('es-AR')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

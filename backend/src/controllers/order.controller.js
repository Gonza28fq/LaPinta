const db = require('../config/database')
const { orderFlow } = require('../sockets/socket.handler')

const BAR_CATEGORY = 'trago'

const hasBarItems = (items) => items.some(i => i.category === BAR_CATEGORY)

const orderHasBarItems = async (queryable, orderId) => {
  const { rows: [r] } = await queryable.query(`
    SELECT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id=$1 AND p.category=$2
    ) AS has_bar_items
  `, [orderId, BAR_CATEGORY])
  return !!r?.has_bar_items
}

const buildOrderItems = async (client, items) => {
  let subtotal = 0
  const enriched = []

  for (const item of items) {
    if (!item.product_id || item.custom) {
      const unitPrice = parseFloat(item.unit_price) || 0
      const quantity = parseInt(item.quantity, 10) || 1
      const itemSubtotal = unitPrice * quantity
      subtotal += itemSubtotal
      enriched.push({
        product_id: null,
        product_name: item.product_name,
        unit_price: unitPrice,
        quantity,
        subtotal: itemSubtotal,
        notes: item.notes || null,
        custom: true,
      })
      continue
    }

    const { rows: [product] } = await client.query(
      'SELECT id, name, current_price, is_available, category FROM products WHERE id=$1',
      [item.product_id])
    if (!product?.is_available) {
      const err = new Error('Producto no disponible: ' + (item.product_name || 'producto'))
      err.status = 400
      throw err
    }

    const unitPrice = parseFloat(item.unit_price) || parseFloat(product.current_price)
    const quantity = parseInt(item.quantity, 10) || 1
    const itemSubtotal = unitPrice * quantity
    subtotal += itemSubtotal
    enriched.push({
      product_id: product.id,
      product_name: item.product_name || product.name,
      unit_price: unitPrice,
      quantity,
      subtotal: itemSubtotal,
      notes: item.notes || null,
      custom: false,
      category: product.category,
    })
  }

  return { subtotal, enriched }
}

const insertOrderItems = async (client, orderId, items) => {
  for (const item of items) {
    await client.query(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [orderId, item.product_id, item.product_name, item.unit_price, item.quantity, item.subtotal, item.notes])
  }
}

exports.getOrders = async (req, res) => {
  try {
    const { status, table_id, waiter_id, date } = req.query
    let q = `
      SELECT o.*, t.number AS table_number, u.name AS waiter_name,
        COUNT(oi.id) AS items_count
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1
    `
    const p = []
    let i = 1
    if (status)    { q += ` AND o.status=$${i++}`; p.push(status) }
    if (table_id)  { q += ` AND o.table_id=$${i++}`; p.push(table_id) }
    if (waiter_id) { q += ` AND o.waiter_id=$${i++}`; p.push(waiter_id) }
    if (date)      { q += ` AND o.created_at::date=$${i++}`; p.push(date) }
    if (req.user.role === 'waiter') {
      q += ` AND o.waiter_id=$${i++} AND o.status NOT IN ('billed','cancelled')`
      p.push(req.user.id)
    }
    q += ' GROUP BY o.id, t.number, u.name ORDER BY o.created_at DESC'
    res.json((await db.query(q, p)).rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al obtener pedidos' })
  }
}

exports.getOrderById = async (req, res) => {
  try {
    const { rows: [order] } = await db.query(`
      SELECT o.*, t.number AS table_number, u.name AS waiter_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.id = $1`, [req.params.id])
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })

    const { rows: items } = await db.query(`
      SELECT oi.*, p.category,
        COALESCE(json_agg(oie) FILTER (WHERE oie.id IS NOT NULL), '[]') AS extras
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN order_item_extras oie ON oie.order_item_id = oi.id
      WHERE oi.order_id = $1
      GROUP BY oi.id, p.category
      ORDER BY oi.created_at`, [order.id])
    res.json({ ...order, items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al obtener pedido' })
  }
}

exports.createOrder = async (req, res) => {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    const {
      table_id, customer_name, customer_id, notes, items,
      order_type = 'mesa', delivery_address,
    } = req.body
    if (!items?.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Sin items' })
    }

    const { subtotal, enriched } = await buildOrderItems(client, items)
    const { rows: [order] } = await client.query(`
      INSERT INTO orders (table_id, customer_id, customer_name, waiter_id, notes, subtotal, total, status, order_type, delivery_address)
      VALUES ($1,$2,$3,$4,$5,$6,$6,'pending',$7,$8) RETURNING *`,
      [table_id || null, customer_id || null, customer_name, req.user.id, notes, subtotal, order_type, delivery_address || null])

    await insertOrderItems(client, order.id, enriched)

    if (table_id) {
      await client.query("UPDATE tables SET status='occupied' WHERE id=$1", [table_id])
    }

    await client.query('COMMIT')

    const fullOrder = { ...order, waiter_name: req.user.name, items: enriched, table_number: null }
    const io = req.app.get('io')
    orderFlow.created(io, fullOrder)
    if (hasBarItems(enriched)) orderFlow.barNew(io, fullOrder)
    res.status(201).json(fullOrder)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Error al crear pedido' })
  } finally {
    client.release()
  }
}

exports.addOrderItems = async (req, res) => {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    const { items, notes } = req.body
    if (!items?.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Sin items' })
    }

    const { rows: [order] } = await client.query(
      "SELECT * FROM orders WHERE id=$1 AND status NOT IN ('billed','cancelled')",
      [req.params.id])
    if (!order) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Pedido activo no encontrado' })
    }

    const { subtotal, enriched } = await buildOrderItems(client, items)
    await insertOrderItems(client, order.id, enriched)
    const { rows: [updated] } = await client.query(`
      UPDATE orders
      SET subtotal=subtotal+$1, total=total+$1,
        notes=CASE WHEN $2::text IS NULL OR $2='' THEN notes ELSE CONCAT_WS(E'\n', notes, $2) END,
        updated_at=NOW()
      WHERE id=$3 RETURNING *`,
      [subtotal, notes || null, order.id])

    await client.query('COMMIT')

    const fullOrder = { ...updated, items: enriched }
    if (hasBarItems(enriched)) orderFlow.barNew(req.app.get('io'), fullOrder)
    res.status(201).json(fullOrder)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Error al agregar consumos' })
  } finally {
    client.release()
  }
}

exports.updateStatus = async (req, res) => {
  const { status } = req.body
  const TRANS = {
    pending:    ['confirmed', 'cancelled'],
    confirmed:  ['in_kitchen', 'cancelled'],
    in_kitchen: ['ready'],
    ready:      ['delivered'],
    delivered:  ['billed'],
    billed:     [],
    cancelled:  [],
  }
  const ROLES = {
    confirmed:  ['manager', 'cashier', 'owner'],
    in_kitchen: ['manager', 'cashier', 'owner', 'kitchen'],
    ready:      ['manager', 'owner', 'kitchen'],
    delivered:  ['waiter', 'manager', 'owner'],
    billed:     ['cashier', 'manager', 'owner'],
    cancelled:  ['manager', 'cashier', 'owner'],
  }
  try {
    const { rows: [order] } = await db.query(
      'SELECT o.*, t.number AS table_number FROM orders o LEFT JOIN tables t ON o.table_id=t.id WHERE o.id=$1',
      [req.params.id])
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    if (!TRANS[order.status]?.includes(status))
      return res.status(400).json({ error: `Transicion invalida: ${order.status} -> ${status}` })
    if (ROLES[status] && !ROLES[status].includes(req.user.role))
      return res.status(403).json({ error: 'Sin permiso para este cambio' })

    const tsMap = { confirmed:'confirmed_at', in_kitchen:'kitchen_at', ready:'ready_at', delivered:'delivered_at', billed:'billed_at' }
    let extra = tsMap[status] ? `,${tsMap[status]}=NOW()` : ''
    if (['confirmed','billed'].includes(status)) extra += `,cashier_id='${req.user.id}'`

    const { rows: [updated] } = await db.query(
      `UPDATE orders SET status=$1${extra},updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id])

    if (status === 'billed' && updated.table_id) {
      await db.query("UPDATE tables SET status='available' WHERE id=$1", [updated.table_id])
    }

    const fullOrder = { ...updated, table_number: order.table_number }
    const io = req.app.get('io')
    if (['confirmed','in_kitchen'].includes(status) && await orderHasBarItems(db, updated.id)) {
      orderFlow.barNew(io, fullOrder)
    }
    const evts = {
      confirmed:  () => orderFlow.confirmed(io, fullOrder),
      in_kitchen: () => orderFlow.inKitchen(io, fullOrder),
      ready:      () => orderFlow.ready(io, fullOrder),
      delivered:  () => orderFlow.delivered(io, fullOrder),
      billed:     () => orderFlow.billed(io, fullOrder),
    }
    evts[status]?.()

    res.json(fullOrder)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar estado' })
  }
}

exports.requestBill = async (req, res) => {
  try {
    const { rows: [o] } = await db.query(
      'SELECT o.*, t.number AS table_number FROM orders o LEFT JOIN tables t ON o.table_id=t.id WHERE o.id=$1',
      [req.params.id])
    if (!o) return res.status(404).json({ error: 'Pedido no encontrado' })
    orderFlow.billRequested(req.app.get('io'), o)
    res.json({ message: 'Solicitud enviada al cajero' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
}

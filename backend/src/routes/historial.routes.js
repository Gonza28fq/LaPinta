const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')

router.use(authenticate, authorize('owner','manager','cashier'))

// GET /api/historial?date=2025-07-08&status=billed&waiter_id=...
router.get('/', async (req, res) => {
  try {
    const { date, status, waiter_id, table_number, from, to } = req.query

    let q = `
      SELECT
        o.*,
        t.number     AS table_number,
        u.name       AS waiter_name,
        c.name       AS cashier_name,
        p.method     AS payment_method,
        p.amount     AS payment_amount,
        p.tip        AS payment_tip,
        COUNT(oi.id) AS items_count
      FROM orders o
      LEFT JOIN tables    t  ON o.table_id   = t.id
      LEFT JOIN users     u  ON o.waiter_id  = u.id
      LEFT JOIN users     c  ON o.cashier_id = c.id
      LEFT JOIN payments  p  ON p.order_id   = o.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1
    `
    const params = []; let i = 1

    if (date)         { q += ` AND o.created_at::date = $${i++}`;    params.push(date) }
    if (from)         { q += ` AND o.created_at::date >= $${i++}`;   params.push(from) }
    if (to)           { q += ` AND o.created_at::date <= $${i++}`;   params.push(to) }
    if (status)       { q += ` AND o.status = $${i++}`;              params.push(status) }
    if (waiter_id)    { q += ` AND o.waiter_id = $${i++}`;           params.push(waiter_id) }
    if (table_number) { q += ` AND t.number = $${i++}`;              params.push(parseInt(table_number)) }

    q += ` GROUP BY o.id, t.number, u.name, c.name, p.method, p.amount, p.tip`
    q += ` ORDER BY o.created_at DESC`

    const { rows } = await db.query(q, params)

    // Totales del período
    const totals = {
      orders:      rows.length,
      billed:      rows.filter(r => r.status === 'billed').length,
      cancelled:   rows.filter(r => r.status === 'cancelled').length,
      revenue:     rows.filter(r => r.status === 'billed').reduce((s, r) => s + parseFloat(r.total || 0), 0),
      tips:        rows.filter(r => r.status === 'billed').reduce((s, r) => s + parseFloat(r.payment_tip || 0), 0),
      avg_ticket:  0,
      by_method:   {},
    }

    const billed = rows.filter(r => r.status === 'billed')
    if (billed.length > 0) totals.avg_ticket = totals.revenue / billed.length

    for (const r of billed) {
      if (r.payment_method) {
        if (!totals.by_method[r.payment_method]) totals.by_method[r.payment_method] = 0
        totals.by_method[r.payment_method] += parseFloat(r.payment_amount || 0)
      }
    }

    res.json({ orders: rows, totals })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al obtener historial' })
  }
})

// GET /api/historial/:id — detalle completo de un pedido
router.get('/:id', async (req, res) => {
  try {
    const { rows: [order] } = await db.query(`
      SELECT o.*, t.number AS table_number, u.name AS waiter_name, c.name AS cashier_name,
        p.method AS payment_method, p.amount AS payment_amount, p.tip AS payment_tip
      FROM orders o
      LEFT JOIN tables   t ON o.table_id   = t.id
      LEFT JOIN users    u ON o.waiter_id  = u.id
      LEFT JOIN users    c ON o.cashier_id = c.id
      LEFT JOIN payments p ON p.order_id   = o.id
      WHERE o.id = $1`, [req.params.id])
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })

    const { rows: items } = await db.query(`
      SELECT oi.* FROM order_items oi WHERE oi.order_id = $1 ORDER BY oi.created_at`, [order.id])

    res.json({ ...order, items })
  } catch { res.status(500).json({ error: 'Error' }) }
})

// GET /api/historial/waiters/list — lista de mozos para filtro
router.get('/waiters/list', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, name FROM users WHERE role IN ('waiter','manager','owner') AND is_active=true ORDER BY name")
    res.json(rows)
  } catch { res.status(500).json({ error: 'Error' }) }
})

module.exports = router

const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')

router.use(authenticate, authorize('owner', 'manager'))

const businessDay = (field) => `
  CASE
    WHEN (${field} AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < TIME '05:00'
      THEN ((${field} AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1)
    ELSE (${field} AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  END
`

const businessWindow = (field) => `
  ((${field} AT TIME ZONE 'America/Argentina/Buenos_Aires')::time >= TIME '19:00'
    OR (${field} AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < TIME '05:00')
`
const getBusinessDate = () => {
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  if (local.getHours() < 5) local.setDate(local.getDate() - 1)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

router.get('/summary', async (req, res) => {
  try {
    const d = req.query.date || getBusinessDate()
    const [orders, revenue, top, avg] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS total, status
        FROM orders
        WHERE ${businessWindow('created_at')} AND ${businessDay('created_at')}=$1::date
        GROUP BY status`, [d]),
      db.query(`
        SELECT COALESCE(SUM(amount),0) AS total, COALESCE(SUM(tip),0) AS tips
        FROM payments
        WHERE ${businessWindow('paid_at')} AND ${businessDay('paid_at')}=$1::date`, [d]),
      db.query(`
        SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id=o.id
        JOIN payments p ON p.order_id=o.id
        WHERE o.status='billed'
          AND ${businessWindow('p.paid_at')}
          AND ${businessDay('p.paid_at')}=$1::date
        GROUP BY oi.product_name
        ORDER BY qty DESC
        LIMIT 8`, [d]),
      db.query(`
        SELECT AVG(o.total) AS avg
        FROM orders o
        JOIN payments p ON p.order_id=o.id
        WHERE o.status='billed'
          AND ${businessWindow('p.paid_at')}
          AND ${businessDay('p.paid_at')}=$1::date`, [d]),
    ])
    res.json({ orders: orders.rows, revenue: revenue.rows[0], topProducts: top.rows, avgTicket: avg.rows[0] })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
})

router.get('/monthly', async (req, res) => {
  try {
    const m = req.query.month || new Date().getMonth() + 1
    const y = req.query.year  || new Date().getFullYear()
    const { rows } = await db.query(`
      SELECT ${businessDay('p.paid_at')} AS day,
        COUNT(DISTINCT o.id) AS orders,
        COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p
      JOIN orders o ON p.order_id=o.id
      WHERE ${businessWindow('p.paid_at')}
        AND EXTRACT(MONTH FROM ${businessDay('p.paid_at')})=$1
        AND EXTRACT(YEAR FROM ${businessDay('p.paid_at')})=$2
      GROUP BY day
      ORDER BY day`, [m, y])
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
})

router.get('/top-products', async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query
    const today = getBusinessDate()
    const dateFrom = from || today
    const dateTo   = to   || today
    const { rows } = await db.query(`
      SELECT oi.product_name, oi.product_id,
        SUM(oi.quantity) AS qty,
        SUM(oi.subtotal) AS revenue,
        AVG(oi.unit_price) AS avg_price,
        COUNT(DISTINCT o.id) AS orders_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN payments p ON p.order_id = o.id
      WHERE o.status = 'billed'
        AND ${businessWindow('p.paid_at')}
        AND ${businessDay('p.paid_at')} BETWEEN $1::date AND $2::date
      GROUP BY oi.product_name, oi.product_id
      ORDER BY qty DESC
      LIMIT $3`, [dateFrom, dateTo, limit])
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
})

router.get('/by-method', async (req, res) => {
  try {
    const { from, to } = req.query
    const today = getBusinessDate()
    const dateFrom = from || today
    const dateTo   = to   || today
    const { rows } = await db.query(`
      SELECT method,
        COUNT(*) AS count,
        SUM(amount) AS total,
        SUM(tip) AS tips,
        AVG(amount) AS avg
      FROM payments
      WHERE ${businessWindow('paid_at')}
        AND ${businessDay('paid_at')} BETWEEN $1::date AND $2::date
      GROUP BY method
      ORDER BY total DESC`, [dateFrom, dateTo])
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
})

router.get('/by-waiter', async (req, res) => {
  try {
    const { from, to } = req.query
    const today = getBusinessDate()
    const dateFrom = from || today
    const dateTo   = to   || today
    const { rows } = await db.query(`
      SELECT
        u.id, u.name, u.avatar_initials,
        COUNT(DISTINCT o.id) AS total_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status='billed') AS billed_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status='cancelled') AS cancelled_orders,
        COALESCE(SUM(p.amount) FILTER (WHERE o.status='billed'), 0) AS total_sales,
        COALESCE(AVG(o.total) FILTER (WHERE o.status='billed'), 0) AS avg_ticket
      FROM users u
      LEFT JOIN orders o ON o.waiter_id = u.id
      LEFT JOIN payments p ON p.order_id = o.id
        AND ${businessWindow('p.paid_at')}
        AND ${businessDay('p.paid_at')} BETWEEN $1::date AND $2::date
      WHERE u.role IN ('waiter','manager','owner') AND u.is_active = true
      GROUP BY u.id, u.name, u.avatar_initials
      HAVING COUNT(p.id) > 0
      ORDER BY total_sales DESC`, [dateFrom, dateTo])
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error' })
  }
})

module.exports = router

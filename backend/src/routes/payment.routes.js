const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')
router.use(authenticate)
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
router.post('/', authorize('cashier','manager','owner'), async (req,res) => {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    const { order_id,method,amount,tip=0,notes } = req.body
    const { rows:[existing] } = await client.query('SELECT id FROM payments WHERE order_id=$1 LIMIT 1', [order_id])
    const { rows:[p] } = await client.query(
      'INSERT INTO payments (order_id,cashier_id,method,amount,tip,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [order_id,req.user.id,method,amount,tip,notes])
    if (!existing) {
      const { rows:[order] } = await client.query('SELECT customer_id,total FROM orders WHERE id=$1', [order_id])
      if (order?.customer_id) {
        await client.query(`
          UPDATE customers
          SET visit_count=visit_count+1,
            total_spent=total_spent+$1,
            updated_at=NOW()
          WHERE id=$2`,
          [order.total || amount || 0, order.customer_id])
      }
    }
    await client.query('COMMIT')
    res.status(201).json(p)
  } catch(e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({error:'Error al registrar pago'})
  } finally {
    client.release()
  }
})
router.get('/cash-closing', authorize('cashier','manager','owner'), async (req,res) => {
  try {
    const d = req.query.date || getBusinessDate()
    const { rows } = await db.query(
      `SELECT method,SUM(amount) AS total,SUM(tip) AS tips,COUNT(*) AS count
       FROM payments
       WHERE ${businessWindow('paid_at')} AND ${businessDay('paid_at')}=$1::date
       GROUP BY method`,[d])
    res.json(rows)
  } catch { res.status(500).json({error:'Error'}) }
})
module.exports = router

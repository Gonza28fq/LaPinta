const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')
const { orderFlow } = require('../sockets/socket.handler')
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
    const { order_id,method,amount,tip=0,notes,items=[] } = req.body
    const { rows:[order] } = await client.query('SELECT * FROM orders WHERE id=$1', [order_id])
    if (!order) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error:'Pedido no encontrado' })
    }
    if (['billed','cancelled'].includes(order.status)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error:'El pedido ya está cerrado' })
    }

    const { rows:[paidRow] } = await client.query(
      'SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id=$1',
      [order_id])
    const paidBefore = parseFloat(paidRow?.paid || 0)
    const remainingBefore = Math.max(0, parseFloat(order.total || 0) - paidBefore)
    const paymentAmount = parseFloat(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error:'Monto inválido' })
    }
    if (paymentAmount > remainingBefore + 0.01) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error:'El cobro supera el saldo pendiente' })
    }

    const { rows:[existing] } = await client.query('SELECT id FROM payments WHERE order_id=$1 LIMIT 1', [order_id])
    const { rows:[p] } = await client.query(
      'INSERT INTO payments (order_id,cashier_id,method,amount,tip,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [order_id,req.user.id,method,paymentAmount,tip,notes])

    if (items.length > 0) {
      let itemAmount = 0
      for (const item of items) {
        const qty = parseInt(item.quantity, 10)
        const itemPay = parseFloat(item.amount)
        if (!item.order_item_id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(itemPay) || itemPay < 0) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error:'Items de pago inválidos' })
        }
        const { rows:[orderItem] } = await client.query(
          'SELECT id,quantity,paid_quantity FROM order_items WHERE id=$1 AND order_id=$2 FOR UPDATE',
          [item.order_item_id, order_id])
        if (!orderItem) {
          await client.query('ROLLBACK')
          return res.status(404).json({ error:'Item no encontrado' })
        }
        const available = Number(orderItem.quantity) - Number(orderItem.paid_quantity || 0)
        if (qty > available) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error:'La cantidad cobrada supera el pendiente' })
        }
        itemAmount += itemPay
        await client.query(
          'INSERT INTO payment_items (payment_id,order_item_id,quantity,amount) VALUES ($1,$2,$3,$4)',
          [p.id, item.order_item_id, qty, itemPay])
        await client.query(
          'UPDATE order_items SET paid_quantity=paid_quantity+$1 WHERE id=$2',
          [qty, item.order_item_id])
      }
      if (Math.abs(itemAmount - paymentAmount) > 0.01) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error:'El total de items no coincide con el cobro' })
      }
    } else {
      await client.query('UPDATE order_items SET paid_quantity=quantity WHERE order_id=$1', [order_id])
    }

    if (order.customer_id) {
      await client.query(`
        UPDATE customers
        SET visit_count=visit_count+$1,
          total_spent=total_spent+$2,
          updated_at=NOW()
        WHERE id=$3`,
        [existing ? 0 : 1, paymentAmount, order.customer_id])
    }

    const paidAfter = paidBefore + paymentAmount
    const remainingAfter = Math.max(0, parseFloat(order.total || 0) - paidAfter)
    let updatedOrder = order
    if (remainingAfter <= 0.01) {
      const { rows:[closed] } = await client.query(
        "UPDATE orders SET status='billed', cashier_id=$1, billed_at=COALESCE(billed_at,NOW()), updated_at=NOW() WHERE id=$2 RETURNING *",
        [req.user.id, order_id])
      updatedOrder = closed
      if (closed.table_id) await client.query("UPDATE tables SET status='available' WHERE id=$1", [closed.table_id])
    }

    await client.query('COMMIT')

    const io = req.app.get('io')
    const payload = { ...updatedOrder, paid_amount: paidAfter, remaining_total: remainingAfter }
    if (remainingAfter <= 0.01) orderFlow.billed(io, payload)
    else orderFlow.paid(io, payload)
    res.status(201).json({ ...p, paid_amount: paidAfter, remaining_total: remainingAfter, is_fully_paid: remainingAfter <= 0.01 })
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

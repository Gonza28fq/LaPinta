const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')

router.use(authenticate, authorize('owner', 'manager'))

// GET /api/auditoria/:userId — actividad completa de un empleado
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { from, to } = req.query
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = from || today
    const dateTo   = to   || today

    const [user, ordersWaiter, ordersConfirmed, ordersBilled, kitchenDone, barDone, shifts, payments] = await Promise.all([
      // Info del empleado
      db.query('SELECT id,name,email,role,is_active,hourly_rate,created_at FROM users WHERE id=$1', [userId]),

      // Pedidos tomados como mozo
      db.query(`
        SELECT o.id, o.status, o.total, o.created_at, t.number AS table_number, o.customer_name
        FROM orders o LEFT JOIN tables t ON o.table_id=t.id
        WHERE o.waiter_id=$1 AND o.created_at::date BETWEEN $2 AND $3
        ORDER BY o.created_at DESC`, [userId, dateFrom, dateTo]),

      // Pedidos confirmados como encargado/cajero
      db.query(`
        SELECT o.id, o.status, o.total, o.confirmed_at, t.number AS table_number
        FROM orders o LEFT JOIN tables t ON o.table_id=t.id
        WHERE o.cashier_id=$1 AND o.confirmed_at IS NOT NULL
          AND o.confirmed_at::date BETWEEN $2 AND $3
        ORDER BY o.confirmed_at DESC`, [userId, dateFrom, dateTo]),

      // Cobros realizados (cashier_id está en orders, no en payments)
      db.query(`
        SELECT p.id, p.method, p.amount, p.tip, p.paid_at,
          t.number AS table_number, o.customer_name
        FROM payments p
        JOIN orders o ON p.order_id=o.id
        LEFT JOIN tables t ON o.table_id=t.id
        WHERE o.cashier_id=$1 AND p.paid_at::date BETWEEN $2 AND $3
        ORDER BY p.paid_at DESC`, [userId, dateFrom, dateTo]),

      // Pedidos despachados por cocina
      db.query(`
        SELECT o.id, o.ready_at, o.kitchen_completed_at, t.number AS table_number,
          o.customer_name,
          COALESCE(SUM(oi.quantity) FILTER (WHERE p.category NOT IN ('bebida','trago')),0)::int AS food_items
        FROM orders o
        LEFT JOIN tables t ON o.table_id=t.id
        LEFT JOIN order_items oi ON oi.order_id=o.id
        LEFT JOIN products p ON p.id=oi.product_id
        WHERE o.kitchen_completed_by=$1
          AND COALESCE(o.kitchen_completed_at,o.ready_at)::date BETWEEN $2 AND $3
        GROUP BY o.id,t.number
        ORDER BY COALESCE(o.kitchen_completed_at,o.ready_at) DESC`, [userId, dateFrom, dateTo]),

      // Tragos preparados por barra
      db.query(`
        SELECT bp.*, o.customer_name, t.number AS table_number
        FROM bar_preparations bp
        JOIN orders o ON o.id=bp.order_id
        LEFT JOIN tables t ON t.id=o.table_id
        WHERE bp.bartender_id=$1 AND bp.prepared_at::date BETWEEN $2 AND $3
        ORDER BY bp.prepared_at DESC`, [userId, dateFrom, dateTo]),

      // Turnos trabajados
      db.query(`
        SELECT * FROM work_shifts
        WHERE user_id=$1 AND clock_in::date BETWEEN $2 AND $3
        ORDER BY clock_in DESC`, [userId, dateFrom, dateTo]),

      // Pagos del mes
      db.query(`
        SELECT * FROM monthly_payments WHERE user_id=$1
        ORDER BY period_year DESC, period_month DESC LIMIT 6`, [userId]),
    ])

    if (!user.rows[0]) return res.status(404).json({ error: 'Empleado no encontrado' })

    // Calcular métricas
    const totalOrders    = ordersWaiter.rows.length
    const billedOrders   = ordersWaiter.rows.filter(o => o.status === 'billed').length
    const cancelledOrders= ordersWaiter.rows.filter(o => o.status === 'cancelled').length
    const totalSales     = ordersWaiter.rows.filter(o => o.status === 'billed').reduce((s,o) => s + parseFloat(o.total||0), 0)
    const totalCobrado   = ordersBilled.rows.reduce((s,p) => s + parseFloat(p.amount||0), 0)
    const totalTips      = ordersBilled.rows.reduce((s,p) => s + parseFloat(p.tip||0), 0)
    const kitchenOrders  = kitchenDone.rows.length
    const kitchenItems   = kitchenDone.rows.reduce((s,o) => s + Number(o.food_items || 0), 0)
    const barOrders      = barDone.rows.length
    const barItems       = barDone.rows.reduce((s,o) => s + Number(o.items_count || 0), 0)
    const totalHours     = shifts.rows.reduce((s,sh) => s + parseFloat(sh.hours_worked||0), 0)

    res.json({
      user: user.rows[0],
      period: { from: dateFrom, to: dateTo },
      metrics: {
        totalOrders, billedOrders, cancelledOrders, totalSales,
        totalConfirmed: ordersConfirmed.rows.length,
        totalCobrado, totalTips,
        kitchenOrders, kitchenItems,
        barOrders, barItems,
        totalHours: totalHours.toFixed(1),
        shiftsCount: shifts.rows.length,
      },
      orders:    ordersWaiter.rows,
      confirmed: ordersConfirmed.rows,
      cobros:    ordersBilled.rows,
      kitchen:   kitchenDone.rows,
      bar:       barDone.rows,
      shifts:    shifts.rows,
      payments:  payments.rows,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al obtener auditoría' })
  }
})

module.exports = router

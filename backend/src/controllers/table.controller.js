const db = require('../config/database')

exports.getTables = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.*,
        o.id AS active_order_id, o.status AS order_status,
        o.total AS order_total, o.customer_name,
        u.name AS waiter_name
      FROM tables t
      LEFT JOIN orders o ON o.table_id = t.id AND o.status NOT IN ('billed','cancelled')
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE t.is_active = true ORDER BY t.number
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener mesas' })
  }
}

exports.getTableById = async (req, res) => {
  try {
    const { rows: [table] } = await db.query('SELECT * FROM tables WHERE id = $1', [req.params.id])
    if (!table) return res.status(404).json({ error: 'Mesa no encontrada' })
    const { rows: orders } = await db.query(`
      SELECT o.*, u.name AS waiter_name FROM orders o
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.table_id = $1 AND o.status NOT IN ('billed','cancelled')
      ORDER BY o.created_at DESC
    `, [table.id])
    res.json({ ...table, orders })
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener mesa' })
  }
}

exports.createTable = async (req, res) => {
  try {
    const { number, capacity = 4, zone, shape = 'square', pos_x = 60, pos_y = 60 } = req.body
    const { rows: [table] } = await db.query(
      'INSERT INTO tables (number, capacity, zone, shape, pos_x, pos_y) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, capacity, zone, shape, pos_x, pos_y]
    )
    res.status(201).json(table)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una mesa con ese número' })
    res.status(500).json({ error: 'Error al crear mesa' })
  }
}

exports.updateTable = async (req, res) => {
  try {
    const { number, capacity, zone, shape, is_active } = req.body
    const { rows: [table] } = await db.query(`
      UPDATE tables SET
        number = COALESCE($1, number), capacity = COALESCE($2, capacity),
        zone = COALESCE($3, zone), shape = COALESCE($4, shape),
        is_active = COALESCE($5, is_active), updated_at = NOW()
      WHERE id = $6 RETURNING *
    `, [number, capacity, zone, shape, is_active, req.params.id])
    if (!table) return res.status(404).json({ error: 'Mesa no encontrada' })
    res.json(table)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar mesa' })
  }
}

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    if (!['available','occupied','reserved','cleaning'].includes(status))
      return res.status(400).json({ error: 'Estado inválido' })
    const { rows: [table] } = await db.query(
      'UPDATE tables SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    )
    req.app.get('io').emit('table:status_changed', table)
    res.json(table)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' })
  }
}

exports.updatePosition = async (req, res) => {
  try {
    const { pos_x, pos_y } = req.body
    const { rows: [table] } = await db.query(
      'UPDATE tables SET pos_x=$1, pos_y=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [pos_x, pos_y, req.params.id]
    )
    res.json(table)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar posición' })
  }
}

exports.deleteTable = async (req, res) => {
  try {
    // Verificar pedidos activos
    const { rows: [active] } = await db.query(
      "SELECT id FROM orders WHERE table_id=$1 AND status NOT IN ('billed','cancelled') LIMIT 1",
      [req.params.id])
    if (active) return res.status(400).json({ error: 'No se puede eliminar una mesa con pedidos activos' })

    // Verificar si tiene historial de pedidos
    const { rows: [hasHistory] } = await db.query(
      'SELECT id FROM orders WHERE table_id=$1 LIMIT 1', [req.params.id])

    if (hasHistory) {
      // Tiene historial: desactivar y liberar el número con negativo
      const { rows: [t] } = await db.query('SELECT number FROM tables WHERE id=$1', [req.params.id])
      await db.query('UPDATE tables SET is_active=false, number=-(number) WHERE id=$1', [req.params.id])
      res.json({ message: `Mesa ${t?.number} eliminada` })
    } else {
      // Sin historial: borrado físico
      await db.query('DELETE FROM tables WHERE id=$1', [req.params.id])
      res.json({ message: 'Mesa eliminada' })
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar mesa' })
  }
}

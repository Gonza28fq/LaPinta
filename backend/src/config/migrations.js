const db = require('./database')

const runMigrations = async () => {
  await db.query("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kitchen'")
  await db.query("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bartender'")
  await db.query("ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'trago'")
  await db.query("ALTER TABLE tables ADD COLUMN IF NOT EXISTS shape VARCHAR(20) NOT NULL DEFAULT 'square'")
  await db.query("ALTER TABLE tables ADD COLUMN IF NOT EXISTS pos_x INTEGER NOT NULL DEFAULT 60")
  await db.query("ALTER TABLE tables ADD COLUMN IF NOT EXISTS pos_y INTEGER NOT NULL DEFAULT 60")
  await db.query("UPDATE tables SET zone='patio' WHERE zone='terraza'")
  await db.query("UPDATE tables SET zone='fondo' WHERE zone='privado'")
  await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'mesa'")
  await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT")
  await db.query("ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL")
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE")
  await db.query(`
    UPDATE customers c
    SET visit_count = stats.visits,
      total_spent = stats.total_spent,
      updated_at = NOW()
    FROM (
      SELECT o.customer_id, COUNT(DISTINCT o.id)::int AS visits, COALESCE(SUM(p.amount),0) AS total_spent
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      WHERE o.customer_id IS NOT NULL
      GROUP BY o.customer_id
    ) stats
    WHERE c.id = stats.customer_id
  `)
}

module.exports = { runMigrations }

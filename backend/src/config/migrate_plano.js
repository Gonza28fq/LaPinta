require('dotenv').config()
const db = require('./database')

async function run() {
  console.log('🔄 Agregando columnas de posición a tables...')
  await db.query(`
    ALTER TABLE tables
      ADD COLUMN IF NOT EXISTS pos_x INTEGER NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS pos_y INTEGER NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS width INTEGER NOT NULL DEFAULT 80,
      ADD COLUMN IF NOT EXISTS height INTEGER NOT NULL DEFAULT 80,
      ADD COLUMN IF NOT EXISTS shape VARCHAR(20) NOT NULL DEFAULT 'square';
  `)
  // Distribuir las mesas existentes en una grilla automática
  const { rows } = await db.query('SELECT id FROM tables ORDER BY number')
  const cols = 4
  for (let i = 0; i < rows.length; i++) {
    const x = (i % cols) * 120 + 40
    const y = Math.floor(i / cols) * 120 + 40
    await db.query('UPDATE tables SET pos_x=$1, pos_y=$2 WHERE id=$3', [x, y, rows[i].id])
  }
  console.log('✅ Columnas agregadas y mesas posicionadas')
  process.exit(0)
}
run().catch(e => { console.error('❌', e); process.exit(1) })

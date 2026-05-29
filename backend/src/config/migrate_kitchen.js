require('dotenv').config()
const db = require('./database')

async function run() {
  console.log('🔄 Agregando rol kitchen...')

  // PostgreSQL no permite ALTER TYPE directamente en uso
  // Hay que crear un nuevo tipo y reemplazarlo
  await db.query(`
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kitchen';
  `)

  console.log('✅ Rol kitchen agregado al enum')

  // Crear usuario de cocina por defecto
  const bcrypt = require('bcryptjs')
  const hash = await bcrypt.hash('cocina2024', 12)
  await db.query(`
    INSERT INTO users (name, email, password_hash, role, avatar_initials)
    VALUES ('Cocina La Pinta', 'cocina@lapinta.com', $1, 'kitchen', 'CO')
    ON CONFLICT (email) DO NOTHING
  `, [hash])

  console.log('✅ Usuario cocina creado: cocina@lapinta.com / cocina2024')
  process.exit(0)
}
run().catch(e => { console.error('❌', e); process.exit(1) })

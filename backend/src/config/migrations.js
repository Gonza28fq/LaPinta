const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const db = require('./database')

const seedInitialData = async () => {
  const hash = await bcrypt.hash('lapinta2024', 12)

  await db.query(`
    INSERT INTO users (name,email,password_hash,role,avatar_initials,hourly_rate) VALUES
      ('Admin La Pinta','admin@lapinta.com',$1,'owner','LP',NULL),
      ('Carlos Encargado','carlos@lapinta.com',$1,'manager','CE',1500),
      ('Ana Moza','ana@lapinta.com',$1,'waiter','AM',1200),
      ('Pedro Cajero','pedro@lapinta.com',$1,'cashier','PC',1300)
    ON CONFLICT (email) DO NOTHING`, [hash])

  await db.query(`
    INSERT INTO tables (number,capacity,zone) VALUES
      (1,2,'salon'),(2,4,'salon'),(3,4,'salon'),(4,6,'salon'),
      (5,2,'patio'),(6,4,'patio'),(7,4,'patio'),(8,8,'fondo')
    ON CONFLICT (number) DO NOTHING`)

  await db.query(`
    INSERT INTO products (name,description,category,current_price,cost_price,is_featured) VALUES
      ('Full','Lechuga, tomate, cebolla morada, pepino dulce','burger',10000,4500,true),
      ('Tex-Mex','Lechuga, tomate, cheddar, guacamole, jalapenos','burger',12000,5500,true),
      ('Big Mac','Lechuga, tomate, cheddar, pepinos escurtidos, salsa big mac','burger',10000,4500,false),
      ('Pulled Pork','Cheddar, pulled pork, coleslaw, bbq','burger',12000,5800,false),
      ('Big Tasty','Lechuga, tomate, cebolla caramelizada','burger',10000,4500,false),
      ('Cheeseburger','Cheddar, mostaza','burger',9000,3800,false),
      ('Chilli Cheeseburger','Cheddar, chilli americano, tomate, pepino','burger',11000,5000,false),
      ('Super Bacon','Cheddar, panceta, barbacoa','burger',10000,4800,true),
      ('HDP','Lechuga, panceta, barbacoa, cebolla crispy','burger',11000,5200,false),
      ('Cuarto de Libra','Medallon doble','burger',10000,4800,false),
      ('Super Bacon & Onion','Cheddar, panceta, cebolla caramelizada, bbq','burger',11000,5200,false),
      ('Milanesa','Pan de la casa, lechuga y tomate','sandwich',9000,3800,false),
      ('Milanesa Completa','Pan de la casa, lechuga, queso y huevo frito','sandwich',10000,4500,false),
      ('Lomito','Pan de la casa, lechuga y tomate','sandwich',9500,4200,true),
      ('Lomito Completo','Pan de la casa, lechuga, jamon, queso y huevo frito','sandwich',11000,5200,false),
      ('Fugazzetta','Salsa de tomate, mozzarella, aceitunas y oregano','pizza',11000,4800,false),
      ('Jamon y Morrones','Salsa de tomate, mozzarella, jamon cocido, morrones asados','pizza',15000,6500,false),
      ('Muzzarella','Salsa de tomate, mozzarella, aceitunas y oregano','pizza',10000,4200,false),
      ('Napolitana','Salsa de tomate, mozzarella, tomates frescos','pizza',13000,5800,false),
      ('Papas 1 topping','Papas con 1 topping a eleccion','papas',7000,2800,false),
      ('Papas 2 toppings','Papas con 2 toppings a eleccion','papas',8000,3200,false),
      ('Papas 3 toppings','Papas con 3 toppings a eleccion','papas',9000,3600,false),
      ('Coca Cola','Gaseosa linea Coca Cola','bebida',2500,1000,false),
      ('Pepsi','Gaseosa linea Pepsi','bebida',2500,1000,false),
      ('Agua','Agua mineral','bebida',1800,700,false),
      ('Fernet','Trago de barra','trago',6000,2500,false),
      ('Gin Tonic','Trago de barra','trago',6500,2700,false),
      ('Nuggets x6','6 nuggets de pollo de la casa','otro',8000,3500,false),
      ('Chilli americano','Con arroz blanco y pan de ajo','otro',9000,3800,false),
      ('Quesadillas pollo/veggie','Opciones blancas y verdes','otro',9000,3800,false)
    ON CONFLICT DO NOTHING`)

  await db.query(`
    INSERT INTO product_extras (name,price,category) VALUES
      ('Cheddar',1500,'queso'),('Bacon',1500,'proteina'),('Huevo frito',1000,'extra'),
      ('Dip x2',1500,'salsa'),('Tasty',1500,'salsa'),('Ranch',1500,'salsa'),
      ('Cheddar a la plancha',500,'queso'),('Criolla',500,'salsa'),
      ('Tomate',0,'topping'),('Cebolla morada',0,'topping'),('Pico de gallo',0,'topping'),
      ('Guacamole',0,'topping'),('Cebolla crispy',0,'topping'),
      ('Chilli americano',0,'topping'),('Bacon',0,'topping'),
      ('Jamon cocido',0,'topping'),('Pulled pork',0,'topping'),
      ('Salsa tasty',0,'topping'),('Aioli',0,'topping'),
      ('Barbacoa',0,'topping'),('Marinara',0,'topping')
    ON CONFLICT DO NOTHING`)
}

const bootstrapSchemaIfNeeded = async () => {
  const type = await db.query("SELECT 1 FROM pg_type WHERE typname = 'user_role'")
  if (type.rowCount > 0) return

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await db.query(schema)
  await seedInitialData()
}

const runMigrations = async () => {
  await bootstrapSchemaIfNeeded()
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

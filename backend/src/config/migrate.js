const fs = require('fs'), path = require('path')
const db = require('./database')
const bcrypt = require('bcryptjs')

async function run() {
  console.log('🔄 Ejecutando migración...')
  await db.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'))
  console.log('✅ Schema listo')

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
      (5,2,'terraza'),(6,4,'terraza'),(7,4,'terraza'),(8,8,'privado')
    ON CONFLICT (number) DO NOTHING`)

  await db.query(`
    INSERT INTO products (name,description,category,current_price,cost_price,is_featured) VALUES
      ('Full','Lechuga, tomate, cebolla morada, pepino dulce','burger',10000,4500,true),
      ('Tex-Mex','Lechuga, tomate, cheddar, guacamole, jalapeños','burger',12000,5500,true),
      ('Big Mac','Lechuga, tomate, cheddar, pepinos escurtidos, salsa big mac','burger',10000,4500,false),
      ('Pulled Pork','Cheddar, pulled pork, coleslaw, bbq','burger',12000,5800,false),
      ('Big Tasty','Lechuga, tomate, cebolla caramelizada','burger',10000,4500,false),
      ('Cheeseburger','Cheddar, mostaza','burger',9000,3800,false),
      ('Chilli Cheeseburger','Cheddar, chilli americano, tomate, pepino','burger',11000,5000,false),
      ('Super Bacon','Cheddar, panceta, barbacoa','burger',10000,4800,true),
      ('HDP','Lechuga, panceta, barbacoa, cebolla crispy','burger',11000,5200,false),
      ('Cuarto de Libra','Medallón doble','burger',10000,4800,false),
      ('Super Bacon & Onion','Cheddar, panceta, cebolla caramelizada, bbq','burger',11000,5200,false),
      ('Milanesa','Pan de la casa, lechuga y tomate','sandwich',9000,3800,false),
      ('Milanesa Completa','Pan de la casa, lechuga, queso y huevo frito','sandwich',10000,4500,false),
      ('Lomito','Pan de la casa, lechuga y tomate','sandwich',9500,4200,true),
      ('Lomito Completo','Pan de la casa, lechuga, jamón, queso y huevo frito','sandwich',11000,5200,false),
      ('Fugazzetta','Salsa de tomate, mozzarella, aceitunas y orégano','pizza',11000,4800,false),
      ('Jamón y Morrones','Salsa de tomate, mozzarella, jamón cocido, morrones asados','pizza',15000,6500,false),
      ('Muzzarella','Salsa de tomate, mozzarella, aceitunas y orégano','pizza',10000,4200,false),
      ('Napolitana','Salsa de tomate, mozzarella, tomates frescos','pizza',13000,5800,false),
      ('Papas 1 topping','Papas con 1 topping a elección','papas',7000,2800,false),
      ('Papas 2 toppings','Papas con 2 toppings a elección','papas',8000,3200,false),
      ('Papas 3 toppings','Papas con 3 toppings a elección','papas',9000,3600,false),
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
      ('Jamón cocido',0,'topping'),('Pulled pork',0,'topping'),
      ('Salsa tasty',0,'topping'),('Aioli',0,'topping'),
      ('Barbacoa',0,'topping'),('Marinara',0,'topping')
    ON CONFLICT DO NOTHING`)

  console.log('✅ Seed completo')
  process.exit(0)
}
run().catch(e => { console.error('❌',e); process.exit(1) })

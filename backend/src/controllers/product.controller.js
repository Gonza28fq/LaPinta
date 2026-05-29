const db = require('../config/database')
exports.getProducts = async (req, res) => {
  try {
    const { category, available } = req.query
    let q = 'SELECT * FROM products WHERE 1=1'; const p=[]; let i=1
    if (category)  { q+=` AND category=$${i++}`; p.push(category) }
    if (available!==undefined) { q+=` AND is_available=$${i++}`; p.push(available==='true') }
    q+=' ORDER BY category,sort_order,name'
    res.json((await db.query(q,p)).rows)
  } catch { res.status(500).json({ error:'Error al obtener productos' }) }
}
exports.getExtras = async (req, res) => {
  try { res.json((await db.query('SELECT * FROM product_extras WHERE is_available=true ORDER BY category,name')).rows) }
  catch { res.status(500).json({ error:'Error al obtener extras' }) }
}
exports.getProductById = async (req, res) => {
  try {
    const { rows:[p] } = await db.query('SELECT * FROM products WHERE id=$1',[req.params.id])
    if (!p) return res.status(404).json({ error:'No encontrado' })
    const { rows:h } = await db.query(
      'SELECT ph.*,u.name AS changed_by_name FROM price_history ph JOIN users u ON ph.changed_by=u.id WHERE ph.product_id=$1 ORDER BY ph.changed_at DESC LIMIT 10',
      [req.params.id])
    res.json({ ...p, price_history:h })
  } catch { res.status(500).json({ error:'Error' }) }
}
exports.createProduct = async (req, res) => {
  try {
    const { name,description,category,current_price,cost_price,is_featured,image_url,sort_order } = req.body
    const { rows:[p] } = await db.query(
      'INSERT INTO products (name,description,category,current_price,cost_price,is_featured,image_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name,description,category,current_price,cost_price||null,is_featured||false,image_url||null,sort_order||0])
    res.status(201).json(p)
  } catch { res.status(500).json({ error:'Error al crear producto' }) }
}
exports.updateProduct = async (req, res) => {
  try {
    const { name,description,category,current_price,cost_price,is_featured,sort_order } = req.body
    const { rows:[old] } = await db.query('SELECT current_price FROM products WHERE id=$1',[req.params.id])
    if (!old) return res.status(404).json({ error:'No encontrado' })
    const { rows:[p] } = await db.query(
      `UPDATE products SET name=COALESCE($1,name),description=COALESCE($2,description),
       category=COALESCE($3,category),current_price=COALESCE($4,current_price),
       cost_price=COALESCE($5,cost_price),is_featured=COALESCE($6,is_featured),
       sort_order=COALESCE($7,sort_order),updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name,description,category,current_price,cost_price,is_featured,sort_order,req.params.id])
    if (current_price && parseFloat(current_price)!==parseFloat(old.current_price)) {
      const pct = ((current_price-old.current_price)/old.current_price*100).toFixed(2)
      await db.query('INSERT INTO price_history (product_id,old_price,new_price,change_pct,changed_by) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id,old.current_price,current_price,pct,req.user.id])
    }
    res.json(p)
  } catch { res.status(500).json({ error:'Error al actualizar' }) }
}
exports.toggleAvailability = async (req, res) => {
  try {
    const { rows:[p] } = await db.query(
      'UPDATE products SET is_available=NOT is_available,updated_at=NOW() WHERE id=$1 RETURNING *',[req.params.id])
    res.json(p)
  } catch { res.status(500).json({ error:'Error' }) }
}
exports.adjustPrices = async (req, res) => {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    const { percentage, category, description } = req.body
    if (!percentage||percentage<=0) return res.status(400).json({ error:'Porcentaje inválido' })
    let q = 'SELECT id,current_price FROM products WHERE is_available=true'; const p=[]
    if (category) { q+=' AND category=$1'; p.push(category) }
    const { rows:prods } = await client.query(q,p)
    for (const prod of prods) {
      const np = Math.round(prod.current_price*(1+percentage/100))
      await client.query('UPDATE products SET current_price=$1,updated_at=NOW() WHERE id=$2',[np,prod.id])
      await client.query('INSERT INTO price_history (product_id,old_price,new_price,change_pct,reason,changed_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [prod.id,prod.current_price,np,percentage.toFixed(2),description||`Ajuste ${percentage}%`,req.user.id])
    }
    await client.query('INSERT INTO price_adjustments (description,percentage,category,products_affected,applied_by) VALUES ($1,$2,$3,$4,$5)',
      [description||`Ajuste ${percentage}%`,percentage,category||null,prods.length,req.user.id])
    await client.query('COMMIT')
    res.json({ message:`Precios ajustados +${percentage}%`, affected:prods.length })
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error:'Error al ajustar precios' }) }
  finally { client.release() }
}

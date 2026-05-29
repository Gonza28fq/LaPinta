const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const db = require('../config/database')
router.use(authenticate)
router.get('/', async (req,res) => {
  try {
    const { search } = req.query
    let q='SELECT * FROM customers WHERE 1=1'; const p=[]
    if (search) { q+=' AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)'; p.push(`%${search}%`) }
    q+=' ORDER BY visit_count DESC,name'
    res.json((await db.query(q,p)).rows)
  } catch { res.status(500).json({error:'Error'}) }
})
router.post('/', async (req,res) => {
  try {
    const { name,phone,email,notes } = req.body
    if (!name) return res.status(400).json({error:'Nombre requerido'})
    const { rows:[c] } = await db.query(
      'INSERT INTO customers (name,phone,email,notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [name,phone||null,email||null,notes||null])
    res.status(201).json(c)
  } catch { res.status(500).json({error:'Error'}) }
})
router.patch('/:id', async (req,res) => {
  try {
    const { name,phone,email,notes } = req.body
    const { rows:[c] } = await db.query(
      `UPDATE customers SET name=COALESCE($1,name),phone=COALESCE($2,phone),email=COALESCE($3,email),notes=COALESCE($4,notes),updated_at=NOW() WHERE id=$5 RETURNING *`,
      [name,phone,email,notes,req.params.id])
    if (!c) return res.status(404).json({error:'No encontrado'})
    res.json(c)
  } catch { res.status(500).json({error:'Error'}) }
})
module.exports = router

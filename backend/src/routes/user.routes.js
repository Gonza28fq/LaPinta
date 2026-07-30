const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database'), bcrypt = require('bcryptjs')
router.use(authenticate)
router.get('/', authorize('owner','manager'), async (req,res) => {
  const { rows } = await db.query('SELECT id,name,email,role,theme,avatar_initials,is_active,hourly_rate,created_at FROM users WHERE is_deleted=false ORDER BY name')
  res.json(rows)
})
router.post('/', authorize('owner'), async (req,res) => {
  try {
    const { name,email,password,role,hourly_rate } = req.body
    const hash = await bcrypt.hash(password,12)
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3)
    const { rows:[u] } = await db.query(
      'INSERT INTO users (name,email,password_hash,role,avatar_initials,hourly_rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,avatar_initials,hourly_rate',
      [name,email.toLowerCase(),hash,role,initials,hourly_rate||null])
    res.status(201).json(u)
  } catch(e) { if(e.code==='23505') return res.status(409).json({error:'Email duplicado'}); res.status(500).json({error:'Error'}) }
})
router.patch('/:id', authorize('owner'), async (req,res) => {
  try {
    const { name,role,is_active,hourly_rate } = req.body
    const { rows:[u] } = await db.query(
      `UPDATE users SET name=COALESCE($1,name),role=COALESCE($2,role),is_active=COALESCE($3,is_active),hourly_rate=COALESCE($4,hourly_rate),updated_at=NOW() WHERE id=$5 RETURNING id,name,email,role,is_active,hourly_rate`,
      [name,role,is_active,hourly_rate,req.params.id])
    if(!u) return res.status(404).json({error:'No encontrado'})
    res.json(u)
  } catch { res.status(500).json({error:'Error'}) }
})
router.patch('/:id/password', authorize('owner'), async (req,res) => {
  try {
    const { password } = req.body
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error:'La contraseña debe tener al menos 6 caracteres' })
    }
    const hash = await bcrypt.hash(password,12)
    const { rows:[u] } = await db.query(
      'UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2 AND is_deleted=false RETURNING id,name,email,role',
      [hash,req.params.id])
    if(!u) return res.status(404).json({error:'No encontrado'})
    res.json({ message:'Contraseña actualizada', user:u })
  } catch {
    res.status(500).json({error:'Error al actualizar contraseña'})
  }
})
router.delete('/:id', authorize('owner'), async (req,res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error:'No podés eliminar tu propio usuario' })
    const { rows:[u] } = await db.query('SELECT id,role,email FROM users WHERE id=$1', [req.params.id])
    if (!u) return res.status(404).json({ error:'No encontrado' })
    if (u.role === 'owner') return res.status(400).json({ error:'No se puede eliminar un dueño' })

    const refs = await Promise.all([
      db.query('SELECT id FROM orders WHERE waiter_id=$1 OR cashier_id=$1 LIMIT 1', [req.params.id]),
      db.query('SELECT id FROM payments WHERE cashier_id=$1 LIMIT 1', [req.params.id]),
      db.query('SELECT id FROM work_shifts WHERE user_id=$1 LIMIT 1', [req.params.id]),
      db.query('SELECT id FROM monthly_payments WHERE user_id=$1 LIMIT 1', [req.params.id]),
    ])
    const hasHistory = refs.some(r => r.rows.length > 0)
    if (hasHistory) {
      await db.query(
        "UPDATE users SET is_active=false,is_deleted=true,email=email || '.deleted.' || extract(epoch from now())::int,updated_at=NOW() WHERE id=$1",
        [req.params.id])
      return res.json({ message:'Empleado eliminado de la operación; se conservó su historial' })
    }

    await db.query('DELETE FROM users WHERE id=$1', [req.params.id])
    res.json({ message:'Empleado eliminado' })
  } catch(e) {
    console.error(e)
    res.status(500).json({error:'Error al eliminar'})
  }
})
module.exports = router

const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const db = require('../config/database')
router.use(authenticate)
router.post('/clock-in', async (req,res) => {
  try { const { rows:[s] } = await db.query('INSERT INTO work_shifts (user_id) VALUES ($1) RETURNING *',[req.user.id]); res.status(201).json(s) }
  catch { res.status(500).json({error:'Error al registrar entrada'}) }
})
router.post('/clock-out', async (req,res) => {
  try {
    const { rows:[s] } = await db.query(
      "UPDATE work_shifts SET clock_out=NOW(),hours_worked=EXTRACT(EPOCH FROM (NOW()-clock_in))/3600 WHERE user_id=$1 AND clock_out IS NULL RETURNING *",
      [req.user.id])
    if (!s) return res.status(400).json({error:'Sin turno abierto'})
    res.json(s)
  } catch { res.status(500).json({error:'Error'}) }
})
router.get('/shifts/:userId', authorize('owner','manager'), async (req,res) => {
  try {
    const { month, year } = req.query
    const { rows } = await db.query(
      'SELECT * FROM work_shifts WHERE user_id=$1 AND EXTRACT(MONTH FROM clock_in)=$2 AND EXTRACT(YEAR FROM clock_in)=$3 ORDER BY clock_in DESC',
      [req.params.userId, month||new Date().getMonth()+1, year||new Date().getFullYear()])
    res.json(rows)
  } catch { res.status(500).json({error:'Error'}) }
})
router.get('/payments', authorize('owner'), async (req,res) => {
  try {
    const { month,year } = req.query
    const { rows } = await db.query(
      'SELECT mp.*,u.name,u.role FROM monthly_payments mp JOIN users u ON mp.user_id=u.id WHERE mp.period_month=$1 AND mp.period_year=$2 ORDER BY u.name',
      [month||new Date().getMonth()+1, year||new Date().getFullYear()])
    res.json(rows)
  } catch { res.status(500).json({error:'Error'}) }
})
router.post('/payments', authorize('owner'), async (req,res) => {
  try {
    const { user_id,period_month,period_year,base_salary,bonuses,deductions,notes } = req.body
    const { rows:[h] } = await db.query(
      'SELECT COALESCE(SUM(hours_worked),0) AS total FROM work_shifts WHERE user_id=$1 AND EXTRACT(MONTH FROM clock_in)=$2 AND EXTRACT(YEAR FROM clock_in)=$3',
      [user_id,period_month,period_year])
    const total = (parseFloat(base_salary)||0)+(parseFloat(bonuses)||0)-(parseFloat(deductions)||0)
    const { rows:[p] } = await db.query(
      `INSERT INTO monthly_payments (user_id,period_month,period_year,total_hours,base_salary,bonuses,deductions,total_pay,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id,period_month,period_year) DO UPDATE SET base_salary=$5,bonuses=$6,deductions=$7,total_pay=$8,notes=$9
       RETURNING *`,
      [user_id,period_month,period_year,h.total,base_salary,bonuses||0,deductions||0,total,notes])
    res.status(201).json(p)
  } catch { res.status(500).json({error:'Error'}) }
})
module.exports = router

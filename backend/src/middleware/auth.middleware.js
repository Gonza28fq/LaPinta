const jwt = require('jsonwebtoken')
const db  = require('../config/database')

const authenticate = async (req, res, next) => {
  try {
    const h = req.headers.authorization
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET)
    const { rows } = await db.query(
      'SELECT id,name,email,role,theme,avatar_initials,is_active,is_deleted FROM users WHERE id=$1',
      [decoded.userId])
    if (!rows[0]?.is_active || rows[0]?.is_deleted) return res.status(401).json({ error: 'No autorizado' })
    req.user = rows[0]
    next()
  } catch (e) {
    res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido' })
  }
}

const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'Sin permiso', required: roles, current: req.user.role })

module.exports = { authenticate, authorize }

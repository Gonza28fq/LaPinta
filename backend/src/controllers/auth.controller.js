const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const db = require('../config/database')

const genTokens = (userId) => ({
  accessToken:  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN||'8h' }),
  refreshToken: jwt.sign({ userId }, process.env.JWT_SECRET+'_refresh', { expiresIn: '30d' }),
})

exports.loginValidation = [
  body('email').isEmail(), body('password').notEmpty()
]
exports.login = async (req, res) => {
  const errs = validationResult(req)
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() })
  const { email, password } = req.body
  try {
    const { rows } = await db.query(
      'SELECT id,name,email,password_hash,role,theme,avatar_initials,is_active,is_deleted FROM users WHERE email=$1',
      [email.toLowerCase().trim()])
    const user = rows[0]
    if (!user?.is_active || user?.is_deleted || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error:'Credenciales incorrectas' })
    const { accessToken, refreshToken } = genTokens(user.id)
    await db.query("INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 days')",
      [user.id, refreshToken])
    delete user.password_hash
    res.json({ user, accessToken, refreshToken, message:`Bienvenido, ${user.name}` })
  } catch (err) { console.error(err); res.status(500).json({ error:'Error interno' }) }
}
exports.refresh = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ error:'Refresh token requerido' })
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET+'_refresh')
    const { rows } = await db.query('SELECT id FROM refresh_tokens WHERE token=$1 AND expires_at>NOW()',[refreshToken])
    if (!rows[0]) return res.status(401).json({ error:'Token inválido o expirado' })
    const tokens = genTokens(decoded.userId)
    await db.query('DELETE FROM refresh_tokens WHERE token=$1',[refreshToken])
    await db.query("INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 days')",
      [decoded.userId, tokens.refreshToken])
    res.json(tokens)
  } catch { res.status(401).json({ error:'Token inválido' }) }
}
exports.logout = async (req, res) => {
  const { refreshToken } = req.body
  if (refreshToken) await db.query('DELETE FROM refresh_tokens WHERE token=$1',[refreshToken]).catch(()=>{})
  res.json({ message:'Sesión cerrada' })
}
exports.me = (req, res) => res.json({ user: req.user })
exports.updateTheme = async (req, res) => {
  const { theme } = req.body
  if (!['dark_bw','slate_blue','green_black'].includes(theme)) return res.status(400).json({ error:'Tema inválido' })
  await db.query('UPDATE users SET theme=$1 WHERE id=$2',[theme, req.user.id])
  res.json({ message:'Tema actualizado', theme })
}

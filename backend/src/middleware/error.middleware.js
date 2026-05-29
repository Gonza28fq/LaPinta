const errorHandler = (err, req, res, next) => {
  console.error('❌', err.stack)
  if (err.code==='23505') return res.status(409).json({ error:'Ya existe un registro con esos datos' })
  if (err.code==='23503') return res.status(400).json({ error:'Referencia inválida' })
  res.status(err.status||500).json({ error: err.message||'Error interno' })
}
module.exports = { errorHandler }

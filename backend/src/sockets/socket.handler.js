const jwt = require('jsonwebtoken'), db = require('../config/database')
const connectedUsers = new Map()

const initSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET)
      const { rows } = await db.query('SELECT id,name,role FROM users WHERE id=$1 AND is_active=true',[decoded.userId])
      if (!rows[0]) return next(new Error('No autorizado'))
      socket.user = rows[0]; next()
    } catch { next(new Error('Token inválido')) }
  })
  io.on('connection', (socket) => {
    const { id, name, role } = socket.user
    connectedUsers.set(id, { socketId: socket.id, role, name })
    socket.join(`role:${role}`); socket.join(`user:${id}`)
    console.log(`🟢 ${name} (${role}) conectado`)
    socket.on('disconnect', () => { connectedUsers.delete(id); console.log(`🔴 ${name} desconectado`) })
  })
  return io
}

const notifyRole = (io, role, event, data) => io.to(`role:${role}`).emit(event, data)
const notifyUser = (io, userId, event, data) => io.to(`user:${userId}`).emit(event, data)
const notifyAll  = (io, event, data) => io.emit(event, data)

const orderFlow = {
  created:      (io, o) => { notifyRole(io,'manager','order:new',o); notifyRole(io,'cashier','order:new',o); notifyRole(io,'owner','order:new',o) },
  confirmed:    (io, o) => { notifyRole(io,'manager','order:confirmed',o); notifyUser(io,o.waiter_id,'order:confirmed',o) },
  inKitchen:    (io, o) => { notifyRole(io,'manager','order:in_kitchen',o); notifyAll(io,'kitchen:new_order',o) },
  barNew:       (io, o) => { notifyRole(io,'bartender','bar:new_order',o); notifyRole(io,'manager','bar:new_order',o); notifyRole(io,'owner','bar:new_order',o) },
  ready:        (io, o) => { notifyUser(io,o.waiter_id,'order:ready',o); notifyRole(io,'manager','order:ready',o) },
  delivered:    (io, o) => notifyRole(io,'manager','order:delivered',o),
  billRequested:(io, o) => { notifyRole(io,'cashier','order:bill_requested',o); notifyRole(io,'manager','order:bill_requested',o) },
  billed:       (io, o) => { notifyRole(io,'manager','order:billed',o); notifyUser(io,o.waiter_id,'order:billed',o); notifyAll(io,'table:available',{ tableId:o.table_id }) },
}
module.exports = { initSocket, notifyRole, notifyUser, notifyAll, orderFlow, connectedUsers }

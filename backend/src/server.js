require('dotenv').config()
const express = require('express'), http = require('http')
const { Server } = require('socket.io'), cors = require('cors')
const { initSocket } = require('./sockets/socket.handler')
const { errorHandler } = require('./middleware/error.middleware')
const { runMigrations } = require('./config/migrations')

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors:{ origin:process.env.CLIENT_URL||'http://localhost:3000', credentials:true } })

app.use(cors({ origin:[process.env.CLIENT_URL||'http://localhost:3000','*'], credentials:true }))
app.use(express.json())
app.set('io', io)

app.use('/api/auth',      require('./routes/auth.routes'))
app.use('/api/users',     require('./routes/user.routes'))
app.use('/api/tables',    require('./routes/table.routes'))
app.use('/api/products',  require('./routes/product.routes'))
app.use('/api/orders',    require('./routes/order.routes'))
app.use('/api/payments',  require('./routes/payment.routes'))
app.use('/api/staff',     require('./routes/staff.routes'))
app.use('/api/metrics',   require('./routes/metrics.routes'))
app.use('/api/customers', require('./routes/customer.routes'))
app.use('/api/carta',     require('./routes/carta.routes'))
app.use('/api/historial', require('./routes/historial.routes'))
app.use('/api/auditoria', require('./routes/auditoria.routes'))
app.get('/api/health', (_,res) => res.json({ status:'ok', service:'La Pinta API' }))
app.use(errorHandler)

initSocket(io)

const PORT = process.env.PORT||4000
runMigrations()
  .catch(err => {
    console.error('Error al aplicar migraciones', err)
    process.exit(1)
  })
  .then(() => server.listen(PORT, () => console.log(`La Pinta API - puerto ${PORT}`)))

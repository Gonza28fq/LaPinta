const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const o = require('../controllers/order.controller')

router.use(authenticate)
router.get('/',                    o.getOrders)
router.get('/:id',                 o.getOrderById)
router.post('/',                   o.createOrder)
router.post('/:id/items',          o.addOrderItems)
router.patch('/:id/status',        o.updateStatus)
router.post('/:id/bill-request',   o.requestBill)

module.exports = router

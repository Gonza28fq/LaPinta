const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const t = require('../controllers/table.controller')

router.use(authenticate)
router.get('/',              t.getTables)
router.get('/:id',           t.getTableById)
router.post('/',             authorize('owner','manager'), t.createTable)
router.patch('/:id',         authorize('owner','manager'), t.updateTable)
router.patch('/:id/status',  authorize('owner','manager','waiter'), t.updateStatus)
router.patch('/:id/position',authorize('owner','manager'), t.updatePosition)
router.delete('/:id',        authorize('owner','manager'), t.deleteTable)

module.exports = router

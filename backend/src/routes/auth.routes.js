const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const a = require('../controllers/auth.controller')
router.post('/login', a.loginValidation, a.login)
router.post('/refresh', a.refresh)
router.post('/logout', a.logout)
router.get('/me', authenticate, a.me)
router.patch('/theme', authenticate, a.updateTheme)
module.exports = router

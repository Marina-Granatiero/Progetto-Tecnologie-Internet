const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, orderController.creaOrdine);
router.get('/miei', authMiddleware, orderController.mieiOrdini);

module.exports = router;

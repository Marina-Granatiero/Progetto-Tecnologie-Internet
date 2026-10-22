const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Tutto ciò che sta sotto /api/admin richiede JWT valido + ruolo admin
router.use(authMiddleware, adminMiddleware);

router.get('/statistiche', adminController.statistiche);

module.exports = router;

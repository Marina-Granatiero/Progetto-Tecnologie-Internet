const express = require('express');
const router = express.Router();
const settoriController = require('../controllers/settoriController');

router.get('/settori', settoriController.elenco);
router.get('/regole', settoriController.regole);

module.exports = router;

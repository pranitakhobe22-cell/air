'use strict';

const { Router } = require('express');
const { chat } = require('../controllers/aiController');

const router = Router();
router.post('/chat', chat);

module.exports = router;

const express = require('express');
const { getNodes } = require('../controllers/networkController');

const router = express.Router();

// GET /api/v1/network/nodes
router.get('/nodes', getNodes);

module.exports = router;

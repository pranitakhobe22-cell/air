const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Main Intelligence Feed
router.get('/latest', apiController.getLatestData);

// Historical & Projections
router.get('/history', apiController.getHistory);
router.get('/forecast', apiController.getForecast);

// Network & Geo
router.get('/sectors', apiController.getSectors);
router.get('/nodes', apiController.getNodes);

// User Profile
router.get('/profile/:id', apiController.getProfile);
router.post('/profile', apiController.upsertProfile);

module.exports = router;


'use strict';

const { Router } = require('express');
const { analyze, geocodePlace } = require('../controllers/routeController');

const router = Router();
router.post('/analyze', analyze);
router.get('/geocode', geocodePlace);

module.exports = router;

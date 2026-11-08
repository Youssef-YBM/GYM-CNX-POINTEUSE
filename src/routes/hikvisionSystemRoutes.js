const express = require('express');
const router = express.Router();

const hikvisionSystemController = require('../controllers/hikvisionSystemController');

// Sync Hikvision shift/access control plan
router.post('/pointeuses/sync-time', hikvisionSystemController.syncTimeHikvision);
 

module.exports = router;


const express = require('express');
const router = express.Router();

const shiftsController = require('../controllers/shiftsController');

// Sync Hikvision shift/access control plan
router.post('/sync-schedules-templates', shiftsController.syncHikvision);
 

module.exports = router;


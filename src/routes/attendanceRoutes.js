const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
 


// Get attendance with user names for multiple devices
router.post('/members', attendanceController.getAttendanceWithNames);

module.exports = router;
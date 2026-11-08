const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const memberController = require('../controllers/memberController');

// Add member to multiple devices
router.post('/add-or-edit', memberController.addOrEditMember);
// Delete member from multiple devices
router.delete('/delete', memberController.deleteMember); 
router.post('/delete-by-subscription-status',upload.single('members_file'), memberController.deleteMembersBySubscriptionStatus);
router.post('/sync-file',upload.single('members_file'), memberController.syncMembersViaFileJson);
router.post('/capabilities', memberController.checkCapabilities);


module.exports = router;
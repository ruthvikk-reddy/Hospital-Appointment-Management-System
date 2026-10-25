const express = require('express');
const router = express.Router();
const {
  getAdminDashboardStats,
  getAllAdmins,
  createAdmin
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes strictly require 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard-stats', getAdminDashboardStats);
router.get('/list', getAllAdmins);
router.post('/create', createAdmin);

module.exports = router;

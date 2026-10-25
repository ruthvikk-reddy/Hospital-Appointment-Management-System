const express = require('express');
const router = express.Router();
const {
  getPatientDashboardStats,
  getPatientProfile,
  updatePatientProfile,
  getAllPatients,
  getPatientById
} = require('../controllers/patientController');
const { protect, authorize } = require('../middleware/auth');

// Patient profile and dashboard
router.get('/dashboard-stats', protect, authorize('patient'), getPatientDashboardStats);
router.get('/profile', protect, authorize('patient', 'admin'), getPatientProfile);
router.put('/profile', protect, authorize('patient'), updatePatientProfile);

// Admin-only patient management
router.get('/', protect, authorize('admin'), getAllPatients);
router.get('/:id', protect, authorize('admin'), getPatientById);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getAllDoctors,
  getDoctorById,
  getDoctorSlots,
  createDoctor,
  updateDoctor,
  toggleDoctorStatus,
  getDoctorStats
} = require('../controllers/doctorController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Public routes (optionalAuth allows admin to view inactive doctors automatically)
router.get('/', optionalAuth, getAllDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorSlots);

// Doctor & Admin routes
router.get('/:id/stats', protect, authorize('doctor', 'admin'), getDoctorStats);
router.put('/:id', protect, authorize('doctor', 'admin'), updateDoctor);

// Admin-only doctor administration
router.post('/', protect, authorize('admin'), createDoctor);
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleDoctorStatus);

module.exports = router;

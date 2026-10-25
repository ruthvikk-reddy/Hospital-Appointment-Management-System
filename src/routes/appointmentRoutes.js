const express = require('express');
const router = express.Router();
const {
  bookAppointment,
  getAppointments,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

// All appointment operations require authentication
router.use(protect);

// Booking (Patient only - patients book for themselves)
router.post('/', authorize('patient'), bookAppointment);

// List appointments (role-scoped query)
router.get('/', getAppointments);

// Single appointment detail
router.get('/:id', getAppointmentById);

// Reschedule appointment
router.put('/:id/reschedule', rescheduleAppointment);

// Cancel appointment
router.patch('/:id/cancel', cancelAppointment);

// Mark as completed with notes (Doctor & Admin)
router.patch('/:id/complete', authorize('doctor', 'admin'), completeAppointment);

module.exports = router;

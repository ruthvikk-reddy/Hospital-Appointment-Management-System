const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Department = require('../models/Department');
const { formatDateToString, getDayName, generateTimeSlots } = require('../services/slotService');

/**
 * Book a new appointment
 * POST /api/appointments
 * Only authenticated patients can book appointments for themselves.
 * The patient ID is strictly taken from the authenticated user's ID (req.user.id), never from req.body.
 */
const bookAppointment = async (req, res, next) => {
  try {
    // Role check: Only authenticated patients can book appointments
    if (!req.user || req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only authenticated patients can book appointments for themselves.'
      });
    }

    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
    // Patient ID is strictly extracted from the authenticated user's session token
    const patientId = req.user.id;

    if (!doctorId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Doctor, appointment date, appointment time, and visit reason are required.'
      });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found.'
      });
    }

    // Verify doctor exists and is active
    const doctor = await Doctor.findById(doctorId).populate('departmentId');
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    if (doctor.availability !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This doctor is currently unavailable for appointments.'
      });
    }

    if (doctor.departmentId && doctor.departmentId.isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'The department for this doctor is currently inactive and not accepting new appointments.'
      });
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date must be formatted as YYYY-MM-DD.'
      });
    }

    // Validate past dates
    const todayStr = formatDateToString(new Date());
    if (appointmentDate < todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Appointments cannot be booked for past dates.'
      });
    }

    // Validate time format HH:mm
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(appointmentTime)) {
      return res.status(400).json({
        success: false,
        message: 'Appointment time must be formatted as HH:mm (e.g. 09:30).'
      });
    }

    // Check doctor's working days
    const dayOfWeek = getDayName(appointmentDate);
    const workingDays = doctor.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!workingDays.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: `Doctor ${doctor.name} does not take appointments on ${dayOfWeek}s.`
      });
    }

    // If appointment is today, check if the slot is in the past
    if (appointmentDate === todayStr) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [slotH, slotM] = appointmentTime.split(':').map(Number);
      if (slotH * 60 + slotM <= currentMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Selected time slot has already passed for today.'
        });
      }
    }

    // Check for double booking conflict in MongoDB
    const existingConflict = await Appointment.findOne({
      doctorId: doctor._id,
      appointmentDateString: appointmentDate,
      appointmentTime,
      status: 'Booked'
    });

    if (existingConflict) {
      return res.status(409).json({
        success: false,
        message: 'This slot is already booked for this doctor. Please select another slot.'
      });
    }

    // Check if patient already has an active appointment at the exact same date and time
    const patientConflict = await Appointment.findOne({
      patientId,
      appointmentDateString: appointmentDate,
      appointmentTime,
      status: 'Booked'
    });

    if (patientConflict) {
      return res.status(409).json({
        success: false,
        message: 'You already have another active appointment booked at this exact date and time.'
      });
    }

    // Construct standardized appointment date (UTC midnight)
    const [year, month, day] = appointmentDate.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    // Create the appointment document using the authenticated patient's ID
    const appointment = await Appointment.create({
      patientId,
      doctorId: doctor._id,
      departmentId: doctor.departmentId._id,
      appointmentDate: parsedDate,
      appointmentDateString: appointmentDate,
      appointmentTime,
      reason: reason.trim(),
      status: 'Booked'
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'name email phone gender')
      .populate('doctorId', 'name specialization consultationFee')
      .populate('departmentId', 'departmentName');

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      data: populated
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Double-booking conflict: This appointment slot is already reserved.'
      });
    }
    next(error);
  }
};

/**
 * Get appointments with role-based filtering, date filters, and pagination
 * GET /api/appointments
 */
const getAppointments = async (req, res, next) => {
  try {
    const { status, date, doctorId, patientId, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const filter = {};

    // Enforce role-based isolation
    if (req.user.role === 'patient') {
      filter.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filter.doctorId = req.user.id;
    } else if (req.user.role === 'admin') {
      if (doctorId) filter.doctorId = doctorId;
      if (patientId) filter.patientId = patientId;
    }

    if (status) {
      filter.status = status;
    }

    if (date) {
      filter.appointmentDateString = date;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Appointment.countDocuments(filter);

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'name email phone gender bloodGroup')
      .populate('doctorId', 'name specialization consultationFee')
      .populate('departmentId', 'departmentName icon')
      .sort(sort === 'date' ? { appointmentDateString: -1, appointmentTime: -1 } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single appointment details by ID
 * GET /api/appointments/:id
 */
const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email phone gender bloodGroup address')
      .populate('doctorId', 'name email phone specialization consultationFee')
      .populate('departmentId', 'departmentName description icon');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    // Role-based authorization
    if (req.user.role === 'patient' && appointment.patientId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this appointment.'
      });
    }

    if (req.user.role === 'doctor' && appointment.doctorId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view another doctor’s appointment.'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reschedule an existing appointment
 * PUT /api/appointments/:id/reschedule
 */
const rescheduleAppointment = async (req, res, next) => {
  try {
    const { newDate, newTime } = req.body;

    if (!newDate || !newTime) {
      return res.status(400).json({
        success: false,
        message: 'New appointment date (YYYY-MM-DD) and new time (HH:mm) are required.'
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    // Role-based authorization
    if (req.user.role === 'patient' && appointment.patientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only reschedule your own appointments.'
      });
    }

    if (req.user.role === 'doctor' && appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only reschedule your own appointments.'
      });
    }

    // Rule: Can only reschedule 'Booked' appointments
    if (appointment.status !== 'Booked') {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule an appointment with status '${appointment.status}'. Only active Booked appointments can be rescheduled.`
      });
    }

    // Rule: Validate new date is not in the past
    const todayStr = formatDateToString(new Date());
    if (newDate < todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule to a past date.'
      });
    }

    // Fetch doctor to verify working days
    const doctor = await Doctor.findById(appointment.doctorId);
    if (!doctor || doctor.availability !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'The assigned doctor is currently inactive or unavailable.'
      });
    }

    const dayOfWeek = getDayName(newDate);
    const workingDays = doctor.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!workingDays.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: `Doctor does not consult on ${dayOfWeek}s.`
      });
    }

    // Check conflict for new slot (excluding current appointment)
    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: appointment.doctorId,
      appointmentDateString: newDate,
      appointmentTime: newTime,
      status: 'Booked'
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'The requested new slot is already booked for this doctor. Please choose a different time slot.'
      });
    }

    // Update the existing appointment document
    const [year, month, day] = newDate.split('-').map(Number);
    appointment.appointmentDate = new Date(Date.UTC(year, month - 1, day));
    appointment.appointmentDateString = newDate;
    appointment.appointmentTime = newTime;

    await appointment.save();

    const updated = await Appointment.findById(appointment._id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialization consultationFee')
      .populate('departmentId', 'departmentName');

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully!',
      data: updated
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'The requested slot is already booked by another patient.'
      });
    }
    next(error);
  }
};

/**
 * Cancel an appointment
 * PATCH /api/appointments/:id/cancel
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    // Authorization
    if (req.user.role === 'patient' && appointment.patientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own appointments.'
      });
    }

    if (req.user.role === 'doctor' && appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own appointments.'
      });
    }

    // Rule: Cannot cancel if already Completed or already Cancelled
    if (appointment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This appointment is already cancelled.'
      });
    }

    if (appointment.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be cancelled.'
      });
    }

    // Update status to Cancelled and record audit metadata
    appointment.status = 'Cancelled';
    appointment.cancelledReason = reason || 'Cancelled by user';
    appointment.cancelledBy = req.user.role === 'patient' ? 'Patient' : req.user.role === 'doctor' ? 'Doctor' : 'Admin';
    appointment.cancelledAt = new Date();

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully. The time slot is now released.',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark appointment as Completed with notes (Doctor or Admin)
 * PATCH /api/appointments/:id/complete
 */
const completeAppointment = async (req, res, next) => {
  try {
    const { consultationNotes, prescription } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    // Doctor authorization
    if (req.user.role === 'doctor' && appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only complete appointments assigned to you.'
      });
    }

    if (appointment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark a cancelled appointment as completed.'
      });
    }

    appointment.status = 'Completed';
    if (consultationNotes) appointment.consultationNotes = consultationNotes.trim();
    if (prescription) appointment.prescription = prescription.trim();

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment marked as completed.',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookAppointment,
  getAppointments,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment
};

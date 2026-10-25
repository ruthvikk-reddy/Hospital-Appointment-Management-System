const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const { formatDateToString } = require('../services/slotService');

/**
 * Get logged-in patient's dashboard summary & statistics
 * GET /api/patients/dashboard-stats
 */
const getPatientDashboardStats = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const todayStr = formatDateToString(new Date());

    // Aggregation: Count appointments grouped by status for this patient
    const statusCounts = await Appointment.aggregate([
      { $match: { patientId: new mongoose.Types.ObjectId(patientId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      total: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0
    };

    statusCounts.forEach((item) => {
      stats.total += item.count;
      if (item._id === 'Booked') stats.upcoming = item.count;
      if (item._id === 'Completed') stats.completed = item.count;
      if (item._id === 'Cancelled') stats.cancelled = item.count;
    });

    // Fetch the nearest upcoming booked appointment
    const nextAppointment = await Appointment.findOne({
      patientId,
      status: 'Booked',
      appointmentDateString: { $gte: todayStr }
    })
      .populate('doctorId', 'name specialization consultationFee')
      .populate('departmentId', 'departmentName')
      .sort({ appointmentDateString: 1, appointmentTime: 1 });

    res.status(200).json({
      success: true,
      data: {
        stats,
        nextAppointment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current patient profile
 * GET /api/patients/profile
 */
const getPatientProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.user.id).select('-passwordHash');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update patient profile
 * PUT /api/patients/profile
 */
const updatePatientProfile = async (req, res, next) => {
  try {
    const { name, phone, gender, dateOfBirth, bloodGroup, address } = req.body;

    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    if (name) patient.name = name.trim();
    if (phone) patient.phone = phone.trim();
    if (gender) patient.gender = gender;
    if (dateOfBirth) patient.dateOfBirth = new Date(dateOfBirth);
    if (bloodGroup) patient.bloodGroup = bloodGroup;
    if (address !== undefined) patient.address = address.trim();

    await patient.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all patients (Admin only)
 * GET /api/patients
 */
const getAllPatients = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { email: { $regex: new RegExp(search, 'i') } },
        { phone: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Patient.countDocuments(query);

    const patients = await Patient.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: patients.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific patient details and their appointment history (Admin only)
 * GET /api/patients/:id
 */
const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id).select('-passwordHash');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    const appointments = await Appointment.find({ patientId: patient._id })
      .populate('doctorId', 'name specialization')
      .populate('departmentId', 'departmentName')
      .sort({ appointmentDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        patient,
        appointmentHistory: appointments
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatientDashboardStats,
  getPatientProfile,
  updatePatientProfile,
  getAllPatients,
  getPatientById
};

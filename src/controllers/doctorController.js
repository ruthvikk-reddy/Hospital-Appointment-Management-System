const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Admin = require('../models/Admin');
const { getDoctorAvailableSlots, formatDateToString } = require('../services/slotService');

/**
 * Get all doctors with filters, search, and pagination
 * GET /api/doctors
 */
const getAllDoctors = async (req, res, next) => {
  try {
    const { search, department, specialization, availability, includeInactive, page = 1, limit = 20 } = req.query;

    const query = {};

    // Availability filter:
    // If includeInactive === 'true' or availability === 'all', return all doctors regardless of status.
    // If availability is explicitly passed ('active' or 'inactive'), filter accordingly.
    // If logged in as admin and no filter is specified, return all doctors.
    // Otherwise (public/patient without explicit parameters), default to active doctors only.
    if (includeInactive === 'true' || availability === 'all') {
      // Return all doctors regardless of availability
    } else if (availability) {
      query.availability = availability;
    } else if (req.user && req.user.role === 'admin') {
      // Admin sees all doctors by default
    } else {
      query.availability = 'active';
    }

    // Department filter
    if (department) {
      query.departmentId = department;
    }

    // Specialization filter
    if (specialization) {
      query.specialization = { $regex: new RegExp(specialization, 'i') };
    }

    // Name or keyword search
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { specialization: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Doctor.countDocuments(query);

    const doctors = await Doctor.find(query)
      .select('-passwordHash')
      .populate('departmentId', 'departmentName icon')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: doctors.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: doctors
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get doctor by ID
 * GET /api/doctors/:id
 */
const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .select('-passwordHash')
      .populate('departmentId', 'departmentName description icon');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get doctor's available slots for a specific date
 * GET /api/doctors/:id/slots?date=YYYY-MM-DD
 */
const getDoctorSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter date (YYYY-MM-DD) is required.'
      });
    }

    const slotData = await getDoctorAvailableSlots(req.params.id, date);

    res.status(200).json({
      success: true,
      data: slotData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create a new doctor (Admin only)
 * POST /api/doctors
 */
const createDoctor = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      specialization,
      departmentId,
      qualifications,
      experienceYears,
      consultationFee,
      bio,
      workingDays,
      workingHours,
      slotDurationMinutes
    } = req.body;

    if (!name || !email || !phone || !password || !specialization || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, password, specialization, and department are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify department exists
    const dept = await Department.findById(departmentId);
    if (!dept) {
      return res.status(400).json({
        success: false,
        message: 'Specified department does not exist.'
      });
    }

    // Check duplicate email across models
    const existingPatient = await Patient.findOne({ email: normalizedEmail });
    const existingDoctor = await Doctor.findOne({ email: normalizedEmail });
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });

    if (existingPatient || existingDoctor || existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const passwordHash = await Doctor.hashPassword(password);

    const doctor = await Doctor.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      specialization: specialization.trim(),
      departmentId,
      qualifications: Array.isArray(qualifications) ? qualifications : qualifications ? [qualifications] : ['MBBS'],
      experienceYears: Number(experienceYears) || 0,
      consultationFee: Number(consultationFee) || 500,
      bio: bio ? bio.trim() : undefined,
      workingDays: workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      workingHours: workingHours || { start: '09:00', end: '17:00' },
      slotDurationMinutes: Number(slotDurationMinutes) || 30
    });

    const populated = await Doctor.findById(doctor._id)
      .select('-passwordHash')
      .populate('departmentId', 'departmentName');

    res.status(201).json({
      success: true,
      message: 'Doctor account created successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update doctor profile (Admin or Doctor self)
 * PUT /api/doctors/:id
 */
const updateDoctor = async (req, res, next) => {
  try {
    // Check permission: doctor can update only self, admin can update any doctor
    if (req.user.role === 'doctor' && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'You are only authorized to update your own profile.'
      });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    const {
      name,
      phone,
      specialization,
      departmentId,
      qualifications,
      experienceYears,
      consultationFee,
      bio,
      availability,
      workingDays,
      workingHours,
      slotDurationMinutes,
      password
    } = req.body;

    if (name) doctor.name = name.trim();
    if (phone) doctor.phone = phone.trim();
    if (specialization) doctor.specialization = specialization.trim();
    if (bio !== undefined) doctor.bio = bio.trim();
    if (qualifications) doctor.qualifications = Array.isArray(qualifications) ? qualifications : [qualifications];
    if (experienceYears !== undefined) doctor.experienceYears = Number(experienceYears);
    if (consultationFee !== undefined) doctor.consultationFee = Number(consultationFee);
    if (workingDays) doctor.workingDays = workingDays;
    if (workingHours) doctor.workingHours = workingHours;
    if (slotDurationMinutes) doctor.slotDurationMinutes = Number(slotDurationMinutes);

    // Only Admin can change department or availability
    if (req.user.role === 'admin') {
      if (departmentId) doctor.departmentId = departmentId;
      if (availability) doctor.availability = availability;
    }

    // Optional password change
    if (password && password.length >= 6) {
      doctor.passwordHash = await Doctor.hashPassword(password);
    }

    await doctor.save();

    const updated = await Doctor.findById(doctor._id)
      .select('-passwordHash')
      .populate('departmentId', 'departmentName');

    res.status(200).json({
      success: true,
      message: 'Doctor updated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle doctor availability (Admin only)
 * PATCH /api/doctors/:id/toggle-status
 * Body (optional): { availability: 'active' | 'inactive' } or { status: 'active' | 'inactive' }
 */
const toggleDoctorStatus = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    const requestedStatus = req.body?.availability || req.body?.status;
    if (requestedStatus && ['active', 'inactive'].includes(requestedStatus)) {
      doctor.availability = requestedStatus;
    } else {
      doctor.availability = doctor.availability === 'active' ? 'inactive' : 'active';
    }

    await doctor.save();

    // If reactivating doctor, ensure department isActive is also true so doctor is visible & bookable
    if (doctor.availability === 'active' && doctor.departmentId) {
      const department = await Department.findById(doctor.departmentId);
      if (department && !department.isActive) {
        department.isActive = true;
        await department.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `Doctor status updated to ${doctor.availability}.`,
      availability: doctor.availability,
      data: doctor
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get doctor's dashboard statistics
 * GET /api/doctors/:id/stats
 */
const getDoctorStats = async (req, res, next) => {
  try {
    const doctorId = req.params.id;

    // Authorization check
    if (req.user.role === 'doctor' && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own statistics.'
      });
    }

    const todayStr = formatDateToString(new Date());

    // Aggregation pipeline: Appointment counts grouped by status for this doctor
    const statusCounts = await Appointment.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = {
      Booked: 0,
      Completed: 0,
      Cancelled: 0,
      'No-show': 0
    };

    statusCounts.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    const total = Object.values(statsMap).reduce((a, b) => a + b, 0);

    // Today's appointments
    const todayAppointmentsCount = await Appointment.countDocuments({
      doctorId,
      appointmentDateString: todayStr,
      status: 'Booked'
    });

    res.status(200).json({
      success: true,
      data: {
        totalAppointments: total,
        upcomingBooked: statsMap.Booked,
        completed: statsMap.Completed,
        cancelled: statsMap.Cancelled,
        todayBooked: todayAppointmentsCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getDoctorSlots,
  createDoctor,
  updateDoctor,
  toggleDoctorStatus,
  getDoctorStats
};

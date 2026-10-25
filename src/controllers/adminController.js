const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Admin = require('../models/Admin');

/**
 * Get comprehensive Admin Dashboard statistics using MongoDB Aggregation
 * GET /api/admin/dashboard-stats
 */
const getAdminDashboardStats = async (req, res, next) => {
  try {
    // 1. Primary Collection Counts
    const [totalPatients, totalDoctors, activeDoctors, totalDepartments, totalAppointments] = await Promise.all([
      Patient.countDocuments(),
      Doctor.countDocuments(),
      Doctor.countDocuments({ availability: 'active' }),
      Department.countDocuments(),
      Appointment.countDocuments()
    ]);

    // 2. MongoDB Aggregation: Group Appointments by Status
    const statusAggregation = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const appointmentStats = {
      Booked: 0,
      Completed: 0,
      Cancelled: 0,
      'No-show': 0
    };

    statusAggregation.forEach((item) => {
      if (item._id) {
        appointmentStats[item._id] = item.count;
      }
    });

    // 3. MongoDB Aggregation with $lookup: Group Appointments by Department
    const departmentDistribution = await Appointment.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'departmentDetails'
        }
      },
      {
        $unwind: {
          path: '$departmentDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$departmentDetails.departmentName',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          department: { $ifNull: ['$_id', 'General / Unassigned'] },
          appointments: '$count'
        }
      },
      { $sort: { appointments: -1 } }
    ]);

    // 4. Recent appointments
    const recentAppointments = await Appointment.find()
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialization')
      .populate('departmentId', 'departmentName')
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalPatients,
          totalDoctors,
          activeDoctors,
          totalDepartments,
          totalAppointments,
          bookedAppointments: appointmentStats.Booked,
          completedAppointments: appointmentStats.Completed,
          cancelledAppointments: appointmentStats.Cancelled
        },
        departmentDistribution,
        recentAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all administrators
 * GET /api/admin/list
 */
const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-passwordHash').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new administrator account (Admin only)
 * POST /api/admin/create
 */
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An administrator account with this email already exists.'
      });
    }

    const passwordHash = await Admin.hashPassword(password);
    const newAdmin = await Admin.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    res.status(201).json({
      success: true,
      message: 'New administrator created successfully.',
      data: newAdmin
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboardStats,
  getAllAdmins,
  createAdmin
};

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');
const { generateToken } = require('../middleware/auth');

/**
 * Register a new patient
 * POST /api/auth/register
 */
const registerPatient = async (req, res, next) => {
  try {
    const { name, email, phone, password, gender, dateOfBirth, bloodGroup, address } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists in any user collection
    const existingPatient = await Patient.findOne({ email: normalizedEmail });
    const existingDoctor = await Doctor.findOne({ email: normalizedEmail });
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });

    if (existingPatient || existingDoctor || existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address is already registered.'
      });
    }

    // Hash password
    const passwordHash = await Patient.hashPassword(password);

    // Create patient document in MongoDB
    const patient = await Patient.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      gender: gender || 'Prefer not to say',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      bloodGroup: bloodGroup || 'Unknown',
      address: address ? address.trim() : undefined
    });

    // Generate JWT token
    const token = generateToken({
      id: patient._id.toString(),
      role: 'patient',
      email: patient.email,
      name: patient.name
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to the hospital portal.',
      token,
      user: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        role: 'patient'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Universal Login for Patient, Doctor, and Admin
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Determine target role model
    let user;
    let detectedRole = role;

    if (role === 'doctor') {
      user = await Doctor.findOne({ email: normalizedEmail });
    } else if (role === 'admin') {
      user = await Admin.findOne({ email: normalizedEmail });
    } else if (role === 'patient') {
      user = await Patient.findOne({ email: normalizedEmail });
    } else {
      // Auto-detect role across collections if role is not explicitly provided
      user = await Patient.findOne({ email: normalizedEmail });
      detectedRole = 'patient';

      if (!user) {
        user = await Doctor.findOne({ email: normalizedEmail });
        detectedRole = 'doctor';
      }
      if (!user) {
        user = await Admin.findOne({ email: normalizedEmail });
        detectedRole = 'admin';
      }
    }

    if (!user) {
      // Generic error message for security (don't reveal whether email exists)
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.'
      });
    }

    // Verify password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.'
      });
    }

    // Check if doctor account is active
    if (detectedRole === 'doctor' && user.availability === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your doctor account is currently deactivated. Please contact the administrator.'
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user._id.toString(),
      role: detectedRole,
      email: user.email,
      name: user.name
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: detectedRole,
        ...(detectedRole === 'doctor' && {
          specialization: user.specialization,
          departmentId: user.departmentId
        })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get currently authenticated user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

module.exports = {
  registerPatient,
  login,
  getCurrentUser,
  logout
};

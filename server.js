const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

const { connectDB, getDBStatus } = require('./src/config/db');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const doctorRoutes = require('./src/routes/doctorRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();

// Core Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// System & Database Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// Frontend Page Routing Fallbacks (Friendly direct URLs)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/patient-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});
app.get('/doctor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
app.get('/book-appointment', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book-appointment.html'));
});

// Centralized error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server if not running in automated test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`======================================================`);
      console.log(` Hospital Appointment Management System is Running!`);
      console.log(` Local Server: http://localhost:${PORT}`);
      console.log(` Database:     MongoDB (Checked via Mongoose)`);
      console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
      console.log(`======================================================`);
    });
  });
}

module.exports = app;

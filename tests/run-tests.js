/**
 * Comprehensive Automated Test Suite for Hospital Appointment Management System
 * Covers all 20 required verification scenarios from Project Specification Section 15.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.PORT = '5001';

const app = require('../server');

// Models
const Patient = require('../src/models/Patient');
const Doctor = require('../src/models/Doctor');
const Department = require('../src/models/Department');
const Appointment = require('../src/models/Appointment');
const Admin = require('../src/models/Admin');

const TEST_PORT = 27017;

let mongodProc = null;
let serverInstance = null;
let baseUrl = '';

// Test execution tracking
const testResults = [];

function recordTest(id, name, passed, details = '') {
  testResults.push({ id, name, passed, details });
  const statusStr = passed ? ' [PASS] ' : ' [FAIL] ';
  console.log(`${statusStr} Test ${id}: ${name} ${details ? '(' + details + ')' : ''}`);
}

// HTTP Helper using native fetch
async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${baseUrl}${endpoint}`, options);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

// Check if port is open
function waitForPort(port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
    };
    tryConnect();
  });
}

async function setup() {
  console.log('===========================================================');
  console.log(' Starting Automated Test Environment for DBMS Project');
  console.log('===========================================================');

  // Verify test database port is listening
  console.log(`Connecting to test MongoDB on port ${TEST_PORT}...`);
  await waitForPort(TEST_PORT, 20000);
  console.log('Test MongoDB is ready and listening.');

  // Connect Mongoose to test database
  const testUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:${TEST_PORT}/hospital_test_db`;
  await mongoose.connect(testUri);
  console.log('Connected Mongoose to test database.');

  // Clear test database collections
  await Promise.all([
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Department.deleteMany({}),
    Appointment.deleteMany({}),
    Admin.deleteMany({})
  ]);

  // Ensure database indexes are created
  await Promise.all([
    Patient.init(),
    Doctor.init(),
    Department.init(),
    Appointment.init(),
    Admin.init()
  ]);

  // Start Express server on random/free port
  await new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test Express server listening on ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\nTearing down test environment...');
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  console.log('Teardown complete.');
}

async function runAllTests() {
  let patientToken = '';
  let patientId = '';
  let doctorToken = '';
  let doctorId = '';
  let adminToken = '';
  let departmentId = '';
  let appointmentId = '';

  try {
    // Setup Admin directly for admin tests
    const adminPasswordHash = await Admin.hashPassword('AdminTest@123');
    const adminDoc = await Admin.create({
      name: 'System Admin',
      email: 'admin.test@hospital.com',
      passwordHash: adminPasswordHash
    });

    // TEST 1: Successful patient registration
    try {
      const res = await apiRequest('POST', '/api/auth/register', {
        name: 'John Doe',
        email: 'john.doe@test.com',
        phone: '+91 9876543210',
        password: 'Password@123',
        gender: 'Male',
        bloodGroup: 'O+'
      });
      const passed = res.status === 201 && res.data.success && res.data.token && res.data.user.email === 'john.doe@test.com';
      if (passed) {
        patientToken = res.data.token;
        patientId = res.data.user.id;
      }
      recordTest(1, 'Successful patient registration', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(1, 'Successful patient registration', false, e.message);
    }

    // TEST 2: Duplicate email rejection
    try {
      const res = await apiRequest('POST', '/api/auth/register', {
        name: 'Another John',
        email: 'john.doe@test.com', // Duplicate
        phone: '+91 9876543211',
        password: 'Password@123'
      });
      const passed = res.status === 409 && res.data.success === false;
      recordTest(2, 'Duplicate email rejection', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(2, 'Duplicate email rejection', false, e.message);
    }

    // TEST 3: Password hashing verification
    try {
      const rawUserInDb = await Patient.findById(patientId);
      const isPlaintext = rawUserInDb.passwordHash === 'Password@123';
      const isBcryptHash = rawUserInDb.passwordHash.startsWith('$2') && (await bcrypt.compare('Password@123', rawUserInDb.passwordHash));
      const passed = !isPlaintext && isBcryptHash;
      recordTest(3, 'Password hashing verification', passed, 'Bcrypt salt & hash verified');
    } catch (e) {
      recordTest(3, 'Password hashing verification', false, e.message);
    }

    // TEST 4: Successful login
    try {
      const res = await apiRequest('POST', '/api/auth/login', {
        email: 'john.doe@test.com',
        password: 'Password@123'
      });
      const passed = res.status === 200 && res.data.success && res.data.token;
      recordTest(4, 'Successful login', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(4, 'Successful login', false, e.message);
    }

    // TEST 5: Invalid login rejection
    try {
      const res = await apiRequest('POST', '/api/auth/login', {
        email: 'john.doe@test.com',
        password: 'WrongPassword999!'
      });
      const passed = res.status === 401 && res.data.success === false;
      recordTest(5, 'Invalid login rejection', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(5, 'Invalid login rejection', false, e.message);
    }

    // TEST 6: Unauthenticated access rejection
    try {
      const res = await apiRequest('GET', '/api/appointments');
      const passed = res.status === 401 && res.data.success === false;
      recordTest(6, 'Unauthenticated access rejection', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(6, 'Unauthenticated access rejection', false, e.message);
    }

    // Admin login to get admin token
    const adminLoginRes = await apiRequest('POST', '/api/auth/login', {
      email: 'admin.test@hospital.com',
      password: 'AdminTest@123'
    });
    adminToken = adminLoginRes.data.token;

    // TEST 7: Unauthorized role access rejection (Patient trying to access admin route)
    try {
      const res = await apiRequest('GET', '/api/admin/dashboard-stats', null, patientToken);
      const passed = res.status === 403 && res.data.success === false;
      recordTest(7, 'Unauthorized role access rejection', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(7, 'Unauthorized role access rejection', false, e.message);
    }

    // TEST 8: Successful department creation
    try {
      const res = await apiRequest(
        'POST',
        '/api/departments',
        {
          departmentName: 'Cardiology',
          description: 'Comprehensive cardiovascular care.'
        },
        adminToken
      );
      const passed = res.status === 201 && res.data.success && res.data.data.departmentName === 'Cardiology';
      if (passed) {
        departmentId = res.data.data._id;
      }
      recordTest(8, 'Successful department creation', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(8, 'Successful department creation', false, e.message);
    }

    // Create doctor under this department
    const docPassHash = await Doctor.hashPassword('Doctor@123');
    const doctorDoc = await Doctor.create({
      name: 'Dr. Test Surgeon',
      email: 'dr.surgeon@test.com',
      phone: '+91 9999988888',
      passwordHash: docPassHash,
      specialization: 'Interventional Cardiology',
      departmentId: departmentId,
      availability: 'active',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      workingHours: { start: '09:00', end: '17:00' },
      slotDurationMinutes: 30
    });
    doctorId = doctorDoc._id.toString();

    // Doctor login
    const docLoginRes = await apiRequest('POST', '/api/auth/login', {
      email: 'dr.surgeon@test.com',
      password: 'Doctor@123'
    });
    doctorToken = docLoginRes.data.token;

    // TEST 9: Doctor filtering by department & specialization
    try {
      const res = await apiRequest('GET', `/api/doctors?department=${departmentId}&specialization=Cardiology`);
      const passed = res.status === 200 && res.data.success && res.data.data.length >= 1 && res.data.data[0].name === 'Dr. Test Surgeon';
      recordTest(9, 'Doctor filtering by department and specialization', passed, `Matched ${res.data.count} doctor(s)`);
    } catch (e) {
      recordTest(9, 'Doctor filtering by department and specialization', false, e.message);
    }

    // TEST 10: Successful appointment booking
    const bookingDate = '2026-11-20'; // Guaranteed future date
    const bookingTime = '10:00';
    try {
      const res = await apiRequest(
        'POST',
        '/api/appointments',
        {
          doctorId,
          appointmentDate: bookingDate,
          appointmentTime: bookingTime,
          reason: 'Routine cardiac health examination'
        },
        patientToken
      );
      const passed = res.status === 201 && res.data.success && res.data.data.status === 'Booked';
      if (passed) {
        appointmentId = res.data.data._id;
      }
      recordTest(10, 'Successful appointment booking', passed, `HTTP ${res.status}`);
    } catch (e) {
      recordTest(10, 'Successful appointment booking', false, e.message);
    }

    // TEST 11: Double-booking rejection (Attempt booking same doctor, date & slot)
    try {
      // Create a second patient to attempt concurrent slot booking
      const secondPatientHash = await Patient.hashPassword('Pass@123');
      const secondPatient = await Patient.create({
        name: 'Jane Smith',
        email: 'jane.smith@test.com',
        phone: '+91 9876543299',
        passwordHash: secondPatientHash
      });
      const secondPatientLogin = await apiRequest('POST', '/api/auth/login', {
        email: 'jane.smith@test.com',
        password: 'Pass@123'
      });
      const secondPatientToken = secondPatientLogin.data.token;

      const res = await apiRequest(
        'POST',
        '/api/appointments',
        {
          doctorId,
          appointmentDate: bookingDate,
          appointmentTime: bookingTime, // SAME SLOT
          reason: 'Attempt conflicting booking'
        },
        secondPatientToken
      );
      const passed = res.status === 409 && res.data.success === false;
      recordTest(11, 'Double-booking conflict rejection', passed, `HTTP ${res.status} conflict correctly caught`);
    } catch (e) {
      recordTest(11, 'Double-booking conflict rejection', false, e.message);
    }

    // TEST 12: Past-date appointment rejection
    try {
      const res = await apiRequest(
        'POST',
        '/api/appointments',
        {
          doctorId,
          appointmentDate: '2020-01-01', // Past date
          appointmentTime: '10:00',
          reason: 'Booking in the past'
        },
        patientToken
      );
      const passed = res.status === 400 && res.data.success === false;
      recordTest(12, 'Past-date appointment rejection', passed, `HTTP ${res.status} correctly rejected`);
    } catch (e) {
      recordTest(12, 'Past-date appointment rejection', false, e.message);
    }

    // TEST 13: Successful appointment rescheduling
    const newRescheduleDate = '2026-11-21';
    const newRescheduleTime = '11:00';
    try {
      const res = await apiRequest(
        'PUT',
        `/api/appointments/${appointmentId}/reschedule`,
        {
          newDate: newRescheduleDate,
          newTime: newRescheduleTime
        },
        patientToken
      );
      const passed = res.status === 200 && res.data.success && res.data.data.appointmentDateString === newRescheduleDate;
      recordTest(13, 'Successful appointment rescheduling', passed, `Updated to ${newRescheduleDate} ${newRescheduleTime}`);
    } catch (e) {
      recordTest(13, 'Successful appointment rescheduling', false, e.message);
    }

    // TEST 14: Conflicting rescheduling rejection
    try {
      // Book another slot at 2026-11-22 14:00
      const anotherApp = await Appointment.create({
        patientId,
        doctorId,
        departmentId,
        appointmentDate: new Date('2026-11-22'),
        appointmentDateString: '2026-11-22',
        appointmentTime: '14:00',
        reason: 'Existing booked appointment',
        status: 'Booked'
      });

      // Try rescheduling appointmentId to that already occupied slot
      const res = await apiRequest(
        'PUT',
        `/api/appointments/${appointmentId}/reschedule`,
        {
          newDate: '2026-11-22',
          newTime: '14:00'
        },
        patientToken
      );
      const passed = res.status === 409 && res.data.success === false;
      recordTest(14, 'Conflicting rescheduling rejection', passed, `HTTP ${res.status} conflict caught`);
    } catch (e) {
      recordTest(14, 'Conflicting rescheduling rejection', false, e.message);
    }

    // TEST 15: Appointment cancellation
    try {
      const res = await apiRequest(
        'PATCH',
        `/api/appointments/${appointmentId}/cancel`,
        {
          reason: 'Personal schedule change'
        },
        patientToken
      );
      const passed = res.status === 200 && res.data.success && res.data.data.status === 'Cancelled';
      recordTest(15, 'Appointment cancellation', passed, `Status changed to Cancelled`);
    } catch (e) {
      recordTest(15, 'Appointment cancellation', false, e.message);
    }

    // TEST 16: Appointment history retention (Record preserved in MongoDB after cancellation)
    try {
      const foundInDb = await Appointment.findById(appointmentId);
      const passed = foundInDb !== null && foundInDb.status === 'Cancelled' && foundInDb.cancelledReason === 'Personal schedule change';
      recordTest(16, 'Appointment history retention', passed, 'Document persisted in MongoDB with audit trace');
    } catch (e) {
      recordTest(16, 'Appointment history retention', false, e.message);
    }

    // TEST 17: Appointment status validation (Cannot cancel an already cancelled appointment)
    try {
      const res = await apiRequest(
        'PATCH',
        `/api/appointments/${appointmentId}/cancel`,
        {
          reason: 'Cancel again'
        },
        patientToken
      );
      const passed = res.status === 400 && res.data.success === false;
      recordTest(17, 'Appointment status transition validation', passed, `HTTP ${res.status} rejected redundant cancel`);
    } catch (e) {
      recordTest(17, 'Appointment status transition validation', false, e.message);
    }

    // TEST 18: Patient access restrictions (Patient cannot view another patient's appointment)
    try {
      const otherPatientDoc = await Patient.create({
        name: 'Confidential Patient',
        email: 'confidential@test.com',
        phone: '+91 9999900000',
        passwordHash: 'dummy'
      });
      const otherApp = await Appointment.create({
        patientId: otherPatientDoc._id,
        doctorId,
        departmentId,
        appointmentDate: new Date('2026-11-25'),
        appointmentDateString: '2026-11-25',
        appointmentTime: '15:00',
        reason: 'Confidential consultation',
        status: 'Booked'
      });

      const res = await apiRequest('GET', `/api/appointments/${otherApp._id}`, null, patientToken);
      const passed = res.status === 403 && res.data.success === false;
      recordTest(18, 'Patient cross-access restriction', passed, `HTTP ${res.status} access denied`);
    } catch (e) {
      recordTest(18, 'Patient cross-access restriction', false, e.message);
    }

    // TEST 19: Doctor access restrictions (Doctor cannot modify another doctor's profile)
    try {
      const anotherDoctor = await Doctor.create({
        name: 'Dr. Rival',
        email: 'dr.rival@test.com',
        phone: '+91 9999911111',
        passwordHash: 'dummy',
        specialization: 'Neurology',
        departmentId: departmentId,
        availability: 'active'
      });

      const res = await apiRequest(
        'PUT',
        `/api/doctors/${anotherDoctor._id}`,
        {
          name: 'Hacked Doctor Name'
        },
        doctorToken
      );
      const passed = res.status === 403 && res.data.success === false;
      recordTest(19, 'Doctor cross-access restriction', passed, `HTTP ${res.status} forbidden`);
    } catch (e) {
      recordTest(19, 'Doctor cross-access restriction', false, e.message);
    }

    // TEST 20: Dashboard aggregation results
    try {
      const res = await apiRequest('GET', '/api/admin/dashboard-stats', null, adminToken);
      const hasSummary = res.status === 200 && res.data.success && res.data.data.summary.totalPatients >= 2;
      const hasDeptDist = Array.isArray(res.data.data.departmentDistribution);
      const passed = hasSummary && hasDeptDist;
      recordTest(20, 'Admin dashboard aggregation results', passed, `HTTP ${res.status} aggregation pipeline verified`);
    } catch (e) {
      recordTest(20, 'Admin dashboard aggregation results', false, e.message);
    }

    // TEST 21: Doctor dashboard statistics aggregation (ObjectId fix verification)
    try {
      const res = await apiRequest('GET', `/api/doctors/${doctorId}/stats`, null, doctorToken);
      const passed = res.status === 200 && res.data.success && typeof res.data.data.totalAppointments === 'number' && typeof res.data.data.todayBooked === 'number';
      recordTest(21, 'Doctor dashboard stats aggregation (ObjectId fix verification)', passed, `HTTP ${res.status} total=${res.data?.data?.totalAppointments}`);
    } catch (e) {
      recordTest(21, 'Doctor dashboard stats aggregation (ObjectId fix verification)', false, e.message);
    }

    // TEST 22: Doctor deactivation and reactivation lifecycle
    try {
      // 1. Admin deactivates the doctor
      const deactRes = await apiRequest('PATCH', `/api/doctors/${doctorId}/toggle-status`, null, adminToken);
      const isDeactivated = deactRes.status === 200 && deactRes.data.availability === 'inactive';

      // 2. Public / patient doctor list should NOT include inactive doctor
      const publicDocsRes = await apiRequest('GET', '/api/doctors');
      const hiddenFromPublic = publicDocsRes.status === 200 &&
        !publicDocsRes.data.data.some((d) => d._id.toString() === doctorId.toString());

      // 3. Admin doctor list with includeInactive=true SHOULD include inactive doctor
      const adminDocsRes = await apiRequest('GET', '/api/doctors?includeInactive=true', null, adminToken);
      const visibleToAdmin = adminDocsRes.status === 200 &&
        adminDocsRes.data.data.some((d) => d._id.toString() === doctorId.toString() && d.availability === 'inactive');

      // 4. Inactive doctor cannot accept new appointments
      const bookRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-10',
        appointmentTime: '10:00',
        reason: 'Routine checkup'
      }, patientToken);
      const bookingRejected = bookRes.status === 400;

      // 5. Admin reactivates the doctor
      const reactRes = await apiRequest('PATCH', `/api/doctors/${doctorId}/toggle-status`, null, adminToken);
      const isReactivated = reactRes.status === 200 && reactRes.data.availability === 'active';

      // 6. Doctor is now visible to public / patients again
      const publicAfterRes = await apiRequest('GET', '/api/doctors');
      const visibleAfterReactivation = publicAfterRes.status === 200 &&
        publicAfterRes.data.data.some((d) => d._id.toString() === doctorId.toString() && d.availability === 'active');

      // 7. Doctor can now receive new appointments again
      const bookAfterRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-10',
        appointmentTime: '10:00',
        reason: 'Routine checkup'
      }, patientToken);
      const bookingAllowed = bookAfterRes.status === 201;

      const passed = isDeactivated && hiddenFromPublic && visibleToAdmin && bookingRejected && isReactivated && visibleAfterReactivation && bookingAllowed;
      recordTest(22, 'Doctor deactivation and reactivation lifecycle', passed, `Deactivate->RejectBooking->Reactivate->AllowBooking verified`);
    } catch (e) {
      recordTest(22, 'Doctor deactivation and reactivation lifecycle', false, e.message);
    }

    // TEST 23: Patient-only self-booking and Admin booking rejection
    try {
      // 1. Admin attempts to book an appointment -> Must be rejected with 403 Forbidden
      const adminBookRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-11',
        appointmentTime: '11:00',
        reason: 'Admin trying to book',
        patientId
      }, adminToken);
      const adminRejected = adminBookRes.status === 403;

      // 2. Doctor attempts to book an appointment -> Must be rejected with 403 Forbidden
      const doctorBookRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-11',
        appointmentTime: '11:00',
        reason: 'Doctor trying to book'
      }, doctorToken);
      const doctorRejected = doctorBookRes.status === 403;

      // 3. Patient attempts to pass a spoofed/different patientId in the body
      const dummyOtherPatientId = new mongoose.Types.ObjectId().toString();
      const spoofBodyRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-11',
        appointmentTime: '11:00',
        reason: 'Patient self booking with spoofed body ID',
        patientId: dummyOtherPatientId
      }, patientToken);

      const patientBookSuccess = spoofBodyRes.status === 201;
      // Crucial security check: The booked appointment's patientId must match the authenticated patient, NOT dummyOtherPatientId
      const targetIdInDoc = spoofBodyRes.data?.data?.patientId?._id || spoofBodyRes.data?.data?.patientId;
      const spoofIgnored = targetIdInDoc?.toString() === patientId.toString();

      const passed = adminRejected && doctorRejected && patientBookSuccess && spoofIgnored;
      recordTest(23, 'Patient-only self-booking & Admin booking restriction', passed, `Admin=403, Doctor=403, SpoofedBodyID ignored in favor of req.user.id`);
    } catch (e) {
      recordTest(23, 'Patient-only self-booking & Admin booking restriction', false, e.message);
    }

    // TEST 24: Department deactivation and reactivation lifecycle
    try {
      // 1. Admin deactivates department
      const deactDeptRes = await apiRequest('PATCH', `/api/departments/${departmentId}/toggle-status`, null, adminToken);
      const isDeactivated = deactDeptRes.status === 200 && deactDeptRes.data.isActive === false;

      // 2. Department document still exists in MongoDB and has isActive: false (not deleted)
      const deptInDb = await Department.findById(departmentId);
      const existsAndInactive = deptInDb !== null && deptInDb.isActive === false;

      // 3. Public / patient department list should NOT include inactive department
      const publicDeptsRes = await apiRequest('GET', '/api/departments');
      const hiddenFromPublic = publicDeptsRes.status === 200 &&
        !publicDeptsRes.data.data.some((d) => d._id.toString() === departmentId.toString());

      // 4. Admin department list with includeInactive=true SHOULD include inactive department
      const adminDeptsRes = await apiRequest('GET', '/api/departments?includeInactive=true', null, adminToken);
      const visibleToAdmin = adminDeptsRes.status === 200 &&
        adminDeptsRes.data.data.some((d) => d._id.toString() === departmentId.toString() && d.isActive === false);

      // 5. Patient attempts to book appointment with doctor of inactive department -> must be rejected
      const bookInactiveDeptRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-15',
        appointmentTime: '10:00',
        reason: 'Consultation under inactive department'
      }, patientToken);
      const bookingRejected = bookInactiveDeptRes.status === 400;

      // 6. Admin reactivates department
      const reactDeptRes = await apiRequest('PATCH', `/api/departments/${departmentId}/toggle-status`, null, adminToken);
      const isReactivated = reactDeptRes.status === 200 && reactDeptRes.data.isActive === true;

      // 7. Department is now visible to public / patients again
      const publicAfterRes = await apiRequest('GET', '/api/departments');
      const visibleAfterReactivation = publicAfterRes.status === 200 &&
        publicAfterRes.data.data.some((d) => d._id.toString() === departmentId.toString() && d.isActive === true);

      // 8. Patient can now book appointment with doctor again
      const bookAfterRes = await apiRequest('POST', '/api/appointments', {
        doctorId,
        appointmentDate: '2026-12-15',
        appointmentTime: '10:00',
        reason: 'Consultation after department reactivated'
      }, patientToken);
      const bookingAllowed = bookAfterRes.status === 201;

      const passed = isDeactivated && existsAndInactive && hiddenFromPublic && visibleToAdmin && bookingRejected && isReactivated && visibleAfterReactivation && bookingAllowed;
      recordTest(24, 'Department deactivation and reactivation lifecycle', passed, `Deactivate->PersistInactive->RejectBooking->Reactivate->AllowBooking verified`);
    } catch (e) {
      recordTest(24, 'Department deactivation and reactivation lifecycle', false, e.message);
    }
  } catch (error) {
    console.error('Fatal error during test execution:', error);
  } finally {
    await teardown();
  }

  // Summary
  console.log('\n===========================================================');
  console.log(' AUTOMATED TEST RESULTS SUMMARY');
  console.log('===========================================================');
  const passedCount = testResults.filter((t) => t.passed).length;
  const totalCount = testResults.length;
  console.log(`Total Scenarios Tested: ${totalCount}`);
  console.log(`Passed:                  ${passedCount}`);
  console.log(`Failed:                  ${totalCount - passedCount}`);
  console.log(`Success Rate:            ${((passedCount / totalCount) * 100).toFixed(1)}%`);
  console.log('===========================================================');

  if (passedCount === totalCount) {
    console.log(` ALL ${totalCount} TEST SCENARIOS PASSED WITH FULL COMPLIANCE!`);
    process.exit(0);
  } else {
    console.error(' SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE.');
    process.exit(1);
  }
}

// Run tests
setup()
  .then(runAllTests)
  .catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Admin = require('../models/Admin');
const { connectDB } = require('../config/db');
const { formatDateToString } = require('../services/slotService');

const seedData = async (options = { forceReset: false }) => {
  try {
    console.log('--- Starting Hospital Appointment Management System Database Seeding ---');
    await connectDB();

    const dbName = mongoose.connection.name;
    console.log(`[Seed Target Database]: ${dbName}`);

    if (options.forceReset) {
      if (dbName !== 'hospital_management') {
        throw new Error(
          `Safety Guard Triggered: Database reset is strictly restricted to 'hospital_management'. Current target is '${dbName}'. Reset aborted.`
        );
      }
      console.log('Force reset requested: Cleaning existing collections in hospital_management...');
      await Promise.all([
        Appointment.deleteMany({}),
        Patient.deleteMany({}),
        Doctor.deleteMany({}),
        Department.deleteMany({}),
        Admin.deleteMany({})
      ]);
      console.log('Collections cleared.');
    }

    // 1. Seed Administrator (Only created if missing)
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@hospital.com').toLowerCase().trim();
    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await Admin.hashPassword(process.env.SEED_ADMIN_PASSWORD || 'Admin@123456');
      admin = await Admin.create({
        name: process.env.SEED_ADMIN_NAME || 'Chief Hospital Administrator',
        email: adminEmail,
        passwordHash
      });
      console.log(`[Seed Success]: Administrator created -> ${admin.email}`);
    } else {
      console.log(`[Seed Keep]: Administrator already exists -> ${admin.email}`);
    }

    // 2. Seed & Restore 6 Standard Medical Departments
    const departmentsData = [
      {
        departmentName: 'Cardiology',
        description: 'Comprehensive cardiovascular care including prevention, diagnosis, and treatment of heart conditions.',
        icon: 'heart'
      },
      {
        departmentName: 'Dermatology',
        description: 'Advanced clinical and cosmetic dermatology treating skin, hair, and nail conditions for all ages.',
        icon: 'skin'
      },
      {
        departmentName: 'Orthopedics',
        description: 'Comprehensive musculoskeletal care covering sports injuries, joint replacements, and spine treatments.',
        icon: 'bone'
      },
      {
        departmentName: 'Pediatrics',
        description: 'Dedicated healthcare for infants, children, and adolescents with compassionate specialized care.',
        icon: 'baby'
      },
      {
        departmentName: 'Neurology',
        description: 'Comprehensive neurological evaluation and treatments for stroke, epilepsy, and brain disorders.',
        icon: 'brain'
      },
      {
        departmentName: 'General Medicine',
        description: 'Primary care, chronic disease management, preventive health checks, and routine family wellness.',
        icon: 'stethoscope'
      }
    ];

    const deptMap = {};
    for (const d of departmentsData) {
      let dept = await Department.findOne({ departmentName: d.departmentName });
      if (!dept) {
        dept = await Department.create({ ...d, isActive: true });
        console.log(`[Seed Success]: Department created -> ${dept.departmentName}`);
      } else {
        let updated = false;
        // Reactivate department if it was deactivated
        if (!dept.isActive) {
          dept.isActive = true;
          updated = true;
        }
        if (!dept.description) {
          dept.description = d.description;
          updated = true;
        }
        if (!dept.icon) {
          dept.icon = d.icon;
          updated = true;
        }
        if (updated) {
          await dept.save();
          console.log(`[Seed Restored]: Department reactivated -> ${dept.departmentName}`);
        } else {
          console.log(`[Seed Keep]: Department intact -> ${dept.departmentName}`);
        }
      }
      deptMap[d.departmentName] = dept._id;
    }

    // 3. Seed & Restore 8 Fictional Doctors across departments
    const defaultDoctorPassword = await Doctor.hashPassword('Doctor@123456');

    const doctorsData = [
      {
        name: 'Dr. Rajesh Sharma',
        email: 'dr.rajesh@hospital.com',
        phone: '+91 98765 43210',
        specialization: 'Senior Interventional Cardiologist',
        departmentName: 'Cardiology',
        qualifications: ['MBBS', 'MD - Cardiology', 'DM - Cardiology (AIIMS)'],
        experienceYears: 16,
        consultationFee: 900,
        bio: 'Senior cardiologist with over 16 years of expertise in coronary angioplasty, hypertension, and heart failure management.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: { start: '09:00', end: '16:00' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Priya Venkatesh',
        email: 'dr.priya@hospital.com',
        phone: '+91 98765 43211',
        specialization: 'Pediatric Cardiologist',
        departmentName: 'Cardiology',
        qualifications: ['MBBS', 'MD', 'Fellowship in Pediatric Cardiology'],
        experienceYears: 10,
        consultationFee: 800,
        bio: 'Specialist in congenital heart defects, pediatric echocardiography, and juvenile cardiovascular health.',
        availability: 'active',
        workingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
        workingHours: { start: '10:00', end: '17:00' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Ananya Sen',
        email: 'dr.ananya@hospital.com',
        phone: '+91 98765 43212',
        specialization: 'Consultant Dermatologist',
        departmentName: 'Dermatology',
        qualifications: ['MBBS', 'MD - Dermatology & Venereology'],
        experienceYears: 8,
        consultationFee: 650,
        bio: 'Expert clinical dermatologist offering personalized therapies for eczema, acne, psoriasis, and cosmetic dermatology.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
        workingHours: { start: '09:30', end: '16:30' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Vikram Malhotra',
        email: 'dr.vikram@hospital.com',
        phone: '+91 98765 43213',
        specialization: 'Joint Replacement & Spine Surgeon',
        departmentName: 'Orthopedics',
        qualifications: ['MBBS', 'MS - Orthopedics', 'M.Ch Ortho (UK)'],
        experienceYears: 14,
        consultationFee: 850,
        bio: 'Renowned orthopedic surgeon specializing in robotic knee arthroplasty, hip replacements, and sports ligament repairs.',
        availability: 'active',
        workingDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        workingHours: { start: '09:00', end: '15:00' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Sneha Patel',
        email: 'dr.sneha@hospital.com',
        phone: '+91 98765 43214',
        specialization: 'Chief Pediatrician',
        departmentName: 'Pediatrics',
        qualifications: ['MBBS', 'DCH', 'DNB - Pediatrics'],
        experienceYears: 12,
        consultationFee: 600,
        bio: 'Compassionate pediatrician focusing on child growth milestones, immunization programs, and pediatric emergency medicine.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        workingHours: { start: '09:00', end: '17:00' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Arjun Nair',
        email: 'dr.arjun@hospital.com',
        phone: '+91 98765 43215',
        specialization: 'Senior Neurologist',
        departmentName: 'Neurology',
        qualifications: ['MBBS', 'MD - General Medicine', 'DM - Neurology'],
        experienceYears: 15,
        consultationFee: 1000,
        bio: 'Leading neurologist specializing in migraine therapy, stroke rehabilitation, movement disorders, and neuro-diagnostics.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
        workingHours: { start: '10:00', end: '16:00' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Meera Krishnan',
        email: 'dr.meera@hospital.com',
        phone: '+91 98765 43216',
        specialization: 'Internal Medicine & Diabetic Care Specialist',
        departmentName: 'General Medicine',
        qualifications: ['MBBS', 'MD - General Medicine'],
        experienceYears: 11,
        consultationFee: 500,
        bio: 'Comprehensive physician specialized in preventive medicine, lifestyle diseases, diabetes control, and geriatric wellness.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        workingHours: { start: '08:30', end: '14:30' },
        slotDurationMinutes: 30
      },
      {
        name: 'Dr. Rohan Mehta',
        email: 'dr.rohan@hospital.com',
        phone: '+91 98765 43217',
        specialization: 'Consultant Physician & Family Medicine',
        departmentName: 'General Medicine',
        qualifications: ['MBBS', 'DNB - Family Medicine'],
        experienceYears: 7,
        consultationFee: 500,
        bio: 'Primary care doctor offering comprehensive care, fever clinics, vaccinations, and preventive health screenings.',
        availability: 'active',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
        workingHours: { start: '12:00', end: '18:00' },
        slotDurationMinutes: 30
      }
    ];

    const doctorMap = {};
    for (const doc of doctorsData) {
      const emailLower = doc.email.toLowerCase().trim();
      const targetDeptId = deptMap[doc.departmentName];
      let doctor = await Doctor.findOne({ email: emailLower });
      if (!doctor) {
        doctor = await Doctor.create({
          ...doc,
          departmentId: targetDeptId,
          passwordHash: defaultDoctorPassword
        });
        console.log(`[Seed Success]: Doctor created -> ${doctor.name} (${doc.departmentName})`);
      } else {
        let updated = false;
        // Reactivate doctor availability so patient booking page shows active doctors
        if (doctor.availability !== 'active') {
          doctor.availability = 'active';
          updated = true;
        }
        // Restore correct department reference if missing or mismatch
        if (!doctor.departmentId || doctor.departmentId.toString() !== targetDeptId.toString()) {
          doctor.departmentId = targetDeptId;
          updated = true;
        }
        if (!doctor.workingHours || !doctor.workingHours.start || !doctor.workingHours.end) {
          doctor.workingHours = doc.workingHours;
          updated = true;
        }
        if (!doctor.workingDays || doctor.workingDays.length === 0) {
          doctor.workingDays = doc.workingDays;
          updated = true;
        }
        if (doctor.consultationFee === undefined || doctor.consultationFee === null) {
          doctor.consultationFee = doc.consultationFee;
          updated = true;
        }
        if (updated) {
          await doctor.save();
          console.log(`[Seed Restored]: Doctor reactivated & linked -> ${doctor.name} (${doc.departmentName})`);
        } else {
          console.log(`[Seed Keep]: Doctor intact -> ${doctor.name}`);
        }
      }
      doctorMap[emailLower] = doctor;
    }

    // 4. Seed & Restore Fictional Patients
    const defaultPatientPassword = await Patient.hashPassword('Patient@123456');

    const patientsData = [
      {
        name: 'Rahul Verma',
        email: 'rahul.verma@example.com',
        phone: '+91 99123 45678',
        gender: 'Male',
        dateOfBirth: new Date('1998-05-15'),
        bloodGroup: 'B+',
        address: 'Flat 402, Green Valley Apartments, Bangalore'
      },
      {
        name: 'Anita Desai',
        email: 'anita.desai@example.com',
        phone: '+91 99234 56789',
        gender: 'Female',
        dateOfBirth: new Date('1995-11-20'),
        bloodGroup: 'O+',
        address: 'B-12, Sunrise Residency, Chennai'
      },
      {
        name: 'Siddharth Roy',
        email: 'siddharth.roy@example.com',
        phone: '+91 99345 67890',
        gender: 'Male',
        dateOfBirth: new Date('2001-08-04'),
        bloodGroup: 'A+',
        address: 'Plot 88, Lakeview Enclave, Hyderabad'
      },
      {
        name: 'Pooja Hegde',
        email: 'pooja.hegde@example.com',
        phone: '+91 99456 78901',
        gender: 'Female',
        dateOfBirth: new Date('1993-02-12'),
        bloodGroup: 'AB+',
        address: 'Villa 14, Royal Palm Gardens, Pune'
      }
    ];

    const patientMap = {};
    for (const pat of patientsData) {
      const emailLower = pat.email.toLowerCase().trim();
      let patient = await Patient.findOne({ email: emailLower });
      if (!patient) {
        patient = await Patient.create({
          ...pat,
          passwordHash: defaultPatientPassword
        });
        console.log(`[Seed Success]: Patient created -> ${patient.name}`);
      } else {
        console.log(`[Seed Keep]: Patient intact -> ${patient.name}`);
      }
      patientMap[emailLower] = patient;
    }

    // 5. Reference Healing: Protect existing appointments and restore missing patient references
    const rahul = patientMap['rahul.verma@example.com'];
    const anita = patientMap['anita.desai@example.com'];
    const siddharth = patientMap['siddharth.roy@example.com'];
    const pooja = patientMap['pooja.hegde@example.com'];

    const oldSeededPatientIdMap = {
      '6acc68a3a29cace4ef2543ce': rahul?._id,
      '6acc68a3a29cace4ef2543cf': anita?._id,
      '6acc68a3a29cace4ef2543d0': siddharth?._id,
      '6acc68a3a29cace4ef2543d1': pooja?._id
    };

    const db = mongoose.connection.db;
    for (const [oldId, newId] of Object.entries(oldSeededPatientIdMap)) {
      if (newId) {
        const updateRes = await db.collection('appointments').updateMany(
          { patientId: new mongoose.Types.ObjectId(oldId) },
          { $set: { patientId: newId } }
        );
        if (updateRes.modifiedCount > 0) {
          console.log(`[Reference Healed]: Relinked ${updateRes.modifiedCount} appointments from old patient ID ${oldId} to restored patient ${newId}`);
        }
      }
    }

    // Protect any remaining appointments with orphan patient IDs by creating a placeholder patient document with that exact _id
    const currentPatients = await Patient.find({});
    const patientIdSet = new Set(currentPatients.map(p => p._id.toString()));
    const allAppointments = await db.collection('appointments').find({}).toArray();

    for (const app of allAppointments) {
      if (app.patientId && !patientIdSet.has(app.patientId.toString())) {
        const fallbackEmail = `restored.patient.${app.patientId.toString().slice(-6)}@hospital.com`;
        await Patient.create({
          _id: app.patientId,
          name: 'Restored Patient',
          email: fallbackEmail,
          passwordHash: defaultPatientPassword,
          phone: '+91 99999 00000'
        });
        patientIdSet.add(app.patientId.toString());
        console.log(`[Reference Healed]: Created restored patient placeholder for ID ${app.patientId} (${fallbackEmail})`);
      }
    }

    // 6. Seed Appointments (Booked, Completed, Cancelled)
    const getFutureDateString = (daysAhead) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      return formatDateToString(d);
    };

    const getPastDateString = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return formatDateToString(d);
    };

    const appointmentsData = [
      {
        patientEmail: 'rahul.verma@example.com',
        doctorEmail: 'dr.rajesh@hospital.com',
        dateStr: getPastDateString(5),
        time: '10:00',
        reason: 'Routine cardiac health review and treadmill stress test evaluation.',
        status: 'Completed',
        consultationNotes: 'BP 125/82 mmHg. ECG within normal limits. Advised low-sodium diet and 30 minutes daily cardio.',
        prescription: 'Ecosprin 75mg once daily after lunch for 30 days.'
      },
      {
        patientEmail: 'anita.desai@example.com',
        doctorEmail: 'dr.ananya@hospital.com',
        dateStr: getPastDateString(3),
        time: '11:00',
        reason: 'Severe seasonal skin allergies and itching on hands.',
        status: 'Completed',
        consultationNotes: 'Mild contact dermatitis observed. Prescribed antihistamine and soothing emollient.',
        prescription: 'Levocetirizine 5mg at bedtime for 5 days. Cetaphil moisturizing cream twice daily.'
      },
      {
        patientEmail: 'siddharth.roy@example.com',
        doctorEmail: 'dr.vikram@hospital.com',
        dateStr: getPastDateString(1),
        time: '14:00',
        reason: 'Knee sprain while playing football.',
        status: 'Cancelled',
        cancelledReason: 'Patient had urgent work travel and will reschedule next week.',
        cancelledBy: 'Patient',
        cancelledAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        patientEmail: 'rahul.verma@example.com',
        doctorEmail: 'dr.meera@hospital.com',
        dateStr: getFutureDateString(2),
        time: '10:30',
        reason: 'General annual health checkup and fasting blood sugar test review.',
        status: 'Booked'
      },
      {
        patientEmail: 'anita.desai@example.com',
        doctorEmail: 'dr.priya@hospital.com',
        dateStr: getFutureDateString(3),
        time: '11:30',
        reason: 'Pediatric heart evaluation consultation for family child member.',
        status: 'Booked'
      },
      {
        patientEmail: 'pooja.hegde@example.com',
        doctorEmail: 'dr.arjun@hospital.com',
        dateStr: getFutureDateString(4),
        time: '14:30',
        reason: 'Recurring tension migraines and visual aura symptoms.',
        status: 'Booked'
      }
    ];

    for (const app of appointmentsData) {
      const patient = patientMap[app.patientEmail];
      const doctor = doctorMap[app.doctorEmail];

      if (patient && doctor) {
        // Prevent duplicate bookings by doctor, date, and time
        const existing = await Appointment.findOne({
          doctorId: doctor._id,
          appointmentDateString: app.dateStr,
          appointmentTime: app.time
        });

        if (!existing) {
          const [y, m, d] = app.dateStr.split('-').map(Number);
          await Appointment.create({
            patientId: patient._id,
            doctorId: doctor._id,
            departmentId: doctor.departmentId,
            appointmentDate: new Date(Date.UTC(y, m - 1, d)),
            appointmentDateString: app.dateStr,
            appointmentTime: app.time,
            reason: app.reason,
            status: app.status,
            consultationNotes: app.consultationNotes || '',
            prescription: app.prescription || '',
            cancelledReason: app.cancelledReason || '',
            cancelledBy: app.cancelledBy || null,
            cancelledAt: app.cancelledAt || null
          });
          console.log(`[Seed Success]: Appointment created -> ${patient.name} with ${doctor.name} (${app.status})`);
        } else {
          console.log(`[Seed Keep]: Appointment already exists -> ${doctor.name} at ${app.dateStr} ${app.time}`);
        }
      }
    }

    console.log('--- Database Seeding & Restoration Completed Successfully! ---');
    console.log('\nDemonstration Login Credentials:');
    console.log('1. Administrator: email = admin@hospital.com | password = Admin@123456');
    console.log('2. Doctor (Cardiology): email = dr.rajesh@hospital.com | password = Doctor@123456');
    console.log('3. Doctor (Dermatology): email = dr.ananya@hospital.com | password = Doctor@123456');
    console.log('4. Patient: email = rahul.verma@example.com | password = Patient@123456');
    console.log('5. Patient: email = anita.desai@example.com | password = Patient@123456');
  } catch (error) {
    console.error(`[Seeding Error]: ${error.message}`);
    throw error;
  }
};

// Allow running directly from command line: node src/utils/seed.js
if (require.main === module) {
  const forceReset = process.argv.includes('--reset');
  seedData({ forceReset })
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = seedData;

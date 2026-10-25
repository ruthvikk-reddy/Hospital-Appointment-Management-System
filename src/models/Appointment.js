const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required']
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required']
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required']
    },
    appointmentDateString: {
      type: String,
      required: [true, 'Appointment date string (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD']
    },
    appointmentTime: {
      type: String,
      required: [true, 'Appointment time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be formatted as HH:mm (e.g. 09:30, 14:00)']
    },
    reason: {
      type: String,
      required: [true, 'Reason for visit is required'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
      maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: ['Booked', 'Completed', 'Cancelled', 'No-show'],
      default: 'Booked'
    },
    consultationNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: ''
    },
    prescription: {
      type: String,
      trim: true,
      maxlength: [1000, 'Prescription cannot exceed 1000 characters'],
      default: ''
    },
    cancelledReason: {
      type: String,
      trim: true,
      default: ''
    },
    cancelledBy: {
      type: String,
      enum: ['Patient', 'Doctor', 'Admin', null],
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// MongoDB Partial Unique Index:
// Guarantees at the database level that no two active 'Booked' appointments can exist
// for the exact same doctor, date and time slot. When an appointment is Cancelled,
// it drops out of this partial index, naturally freeing the slot for new bookings.
appointmentSchema.index(
  { doctorId: 1, appointmentDateString: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Booked' },
    name: 'unique_active_doctor_slot'
  }
);

// Secondary Query Optimization Indexes
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ departmentId: 1 });
appointmentSchema.index({ appointmentDateString: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;

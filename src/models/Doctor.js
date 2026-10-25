const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      minlength: [2, 'Doctor name must be at least 2 characters'],
      maxlength: [100, 'Doctor name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Doctor email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required']
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required']
    },
    qualifications: {
      type: [String],
      default: ['MBBS']
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience years cannot be negative'],
      default: 3
    },
    consultationFee: {
      type: Number,
      min: [0, 'Consultation fee cannot be negative'],
      default: 500
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      default: 'Experienced medical practitioner committed to quality patient care.'
    },
    profileImage: {
      type: String,
      default: '/assets/doctor-placeholder.svg'
    },
    availability: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' }
    },
    slotDurationMinutes: {
      type: Number,
      default: 30,
      enum: [15, 20, 30, 45, 60]
    }
  },
  {
    timestamps: true
  }
);

// Indexes
doctorSchema.index({ departmentId: 1, availability: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ name: 'text', specialization: 'text' });

doctorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

doctorSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

doctorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;

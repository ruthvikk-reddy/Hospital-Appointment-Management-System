const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
const formatDateToString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the day name (e.g. 'Monday') from a YYYY-MM-DD string
 */
const getDayName = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Generate slot times between start and end times
 * e.g. start '09:00', end '12:00', duration 30 -> ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
 */
const generateTimeSlots = (startTime = '09:00', endTime = '17:00', durationMinutes = 30) => {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    slots.push(timeStr);
    currentMinutes += durationMinutes;
  }

  return slots;
};

/**
 * Get available appointment slots for a doctor on a specific date
 */
const getDoctorAvailableSlots = async (doctorId, dateString) => {
  const doctor = await Doctor.findById(doctorId).populate('departmentId', 'departmentName isActive');
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  if (doctor.availability !== 'active') {
    return {
      isAvailable: false,
      message: 'This doctor is currently marked as inactive and cannot accept appointments.',
      slots: []
    };
  }

  if (doctor.departmentId && doctor.departmentId.isActive === false) {
    return {
      isAvailable: false,
      message: 'The department for this doctor is currently inactive and cannot accept appointments.',
      slots: []
    };
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const todayStr = formatDateToString(new Date());
  if (dateString < todayStr) {
    return {
      isAvailable: false,
      message: 'Appointments cannot be booked for past dates.',
      slots: []
    };
  }

  // Check doctor's working days
  const dayOfWeek = getDayName(dateString);
  const workingDays = doctor.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (!workingDays.includes(dayOfWeek)) {
    return {
      isAvailable: false,
      message: `Doctor ${doctor.name} does not have clinic hours on ${dayOfWeek}s.`,
      slots: []
    };
  }

  // Generate doctor's slots for the day
  const startTime = doctor.workingHours?.start || '09:00';
  const endTime = doctor.workingHours?.end || '17:00';
  const duration = doctor.slotDurationMinutes || 30;
  const allSlots = generateTimeSlots(startTime, endTime, duration);

  // Fetch currently active (Booked) appointments for this doctor on this date
  const bookedAppointments = await Appointment.find({
    doctorId: doctor._id,
    appointmentDateString: dateString,
    status: 'Booked'
  }).select('appointmentTime');

  const bookedTimeSet = new Set(bookedAppointments.map((a) => a.appointmentTime));

  // If the booking is for today, check past time slots
  const now = new Date();
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

  const slotResults = allSlots.map((slot) => {
    const isBooked = bookedTimeSet.has(slot);
    let isPastTime = false;

    if (dateString === todayStr) {
      const [sh, sm] = slot.split(':').map(Number);
      if (sh * 60 + sm <= currentMinutesToday) {
        isPastTime = true;
      }
    }

    const available = !isBooked && !isPastTime;

    return {
      time: slot,
      available,
      status: isBooked ? 'Booked' : isPastTime ? 'Passed' : 'Available'
    };
  });

  return {
    isAvailable: true,
    doctor: {
      id: doctor._id,
      name: doctor.name,
      specialization: doctor.specialization,
      department: doctor.departmentId ? doctor.departmentId.departmentName : 'General',
      consultationFee: doctor.consultationFee,
      slotDurationMinutes: duration
    },
    date: dateString,
    dayOfWeek,
    totalSlots: slotResults.length,
    availableCount: slotResults.filter((s) => s.available).length,
    slots: slotResults
  };
};

module.exports = {
  formatDateToString,
  getDayName,
  generateTimeSlots,
  getDoctorAvailableSlots
};

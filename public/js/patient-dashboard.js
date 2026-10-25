/**
 * ApexCare Hospital Management System - Patient Dashboard Controller
 */

let allAppointments = [];
let activeRescheduleAppId = null;
let activeCancelAppId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = API.getUser();
  if (user) {
    document.getElementById('patient-name-display').textContent = user.name;
    document.getElementById('patient-avatar-initial').textContent = user.name[0];
  }

  await loadDashboardStats();
  await loadAppointments();
  await loadProfile();
});

// Tab Switcher
function showTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(`tab-${tabId}`);
  const targetLink = document.getElementById(`nav-${tabId}`);
  if (targetPane) targetPane.classList.add('active');
  if (targetLink) targetLink.classList.add('active');
}

// 1. Load Aggregated Stats & Next Upcoming Appointment
async function loadDashboardStats() {
  try {
    const res = await API.get('/api/patients/dashboard-stats');
    const { stats, nextAppointment } = res.data;

    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-upcoming').textContent = stats.upcoming || 0;
    document.getElementById('stat-completed').textContent = stats.completed || 0;
    document.getElementById('stat-cancelled').textContent = stats.cancelled || 0;

    const nextBanner = document.getElementById('next-appointment-banner');
    if (nextAppointment) {
      nextBanner.style.display = 'flex';
      nextBanner.innerHTML = `
        <div class="next-app-info">
          <span style="background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600;">
            Next Scheduled Consultation
          </span>
          <h3 style="margin-top: 0.5rem;">${nextAppointment.doctorId?.name || 'Assigned Doctor'}</h3>
          <p style="font-size: 0.9rem; color: #e0f2fe;">${nextAppointment.departmentId?.departmentName || 'Department'} &bull; Reason: ${nextAppointment.reason}</p>
          <div class="next-app-meta">
            <span>📅 ${nextAppointment.appointmentDateString}</span>
            <span>⏰ ${nextAppointment.appointmentTime}</span>
            <span>💳 ₹${nextAppointment.doctorId?.consultationFee || 500}</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-outline btn-sm" style="color: white; border-color: rgba(255,255,255,0.4);" onclick="openRescheduleModal('${nextAppointment._id}', '${nextAppointment.doctorId?._id}', '${nextAppointment.doctorId?.name}')">Reschedule</button>
          <button class="btn btn-outline-danger btn-sm" onclick="openCancelModal('${nextAppointment._id}')">Cancel</button>
        </div>
      `;
    } else {
      nextBanner.style.display = 'none';
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 2. Load Appointments List
async function loadAppointments() {
  const tbody = document.getElementById('appointments-tbody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading your appointments...</td></tr>`;

  try {
    const res = await API.get('/api/appointments');
    allAppointments = res.data || [];
    renderAppointmentsTable(allAppointments);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-rose); padding: 2rem;">${err.message}</td></tr>`;
  }
}

function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointments-tbody');
  if (appointments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <div class="empty-title">No appointments found</div>
            <p class="empty-desc">You have no matching appointments scheduled. Click below to book a visit.</p>
            <a href="/book-appointment.html" class="btn btn-primary btn-sm">Schedule Now</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = appointments.map(app => {
    let badgeClass = 'badge-booked';
    if (app.status === 'Completed') badgeClass = 'badge-completed';
    if (app.status === 'Cancelled') badgeClass = 'badge-cancelled';

    const isBooked = app.status === 'Booked';

    return `
      <tr>
        <td>
          <strong>${app.appointmentDateString}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${app.appointmentTime}</div>
        </td>
        <td>
          <strong>${app.doctorId?.name || 'Doctor'}</strong>
          <div style="font-size: 0.8rem; color: var(--accent-teal);">${app.departmentId?.departmentName || 'Clinical'}</div>
        </td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${app.reason}">
          ${app.reason}
        </td>
        <td>
          <span class="badge ${badgeClass}">${app.status}</span>
        </td>
        <td>
          ₹${app.doctorId?.consultationFee || 500}
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-outline btn-sm" onclick="viewAppDetails('${app._id}')">Details</button>
            ${isBooked ? `
              <button class="btn btn-outline btn-sm" onclick="openRescheduleModal('${app._id}', '${app.doctorId?._id}', '${app.doctorId?.name}')">Reschedule</button>
              <button class="btn btn-outline-danger btn-sm" onclick="openCancelModal('${app._id}')">Cancel</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter appointments
function filterAppointments() {
  const statusFilter = document.getElementById('filter-status').value;
  const searchDoctor = document.getElementById('filter-doctor').value.toLowerCase().trim();

  let filtered = allAppointments;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  if (searchDoctor) {
    filtered = filtered.filter(a =>
      (a.doctorId?.name || '').toLowerCase().includes(searchDoctor) ||
      (a.departmentId?.departmentName || '').toLowerCase().includes(searchDoctor)
    );
  }

  renderAppointmentsTable(filtered);
}

// 3. Reschedule Modal
let rescheduleDoctorId = null;
let chosenRescheduleTime = null;

function openRescheduleModal(appointmentId, doctorId, doctorName) {
  activeRescheduleAppId = appointmentId;
  rescheduleDoctorId = doctorId;
  chosenRescheduleTime = null;

  document.getElementById('reschedule-doctor-name').textContent = doctorName;
  const dateInput = document.getElementById('reschedule-date');
  dateInput.value = '';
  dateInput.min = new Date().toISOString().split('T')[0];

  document.getElementById('reschedule-slots-box').innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Select a date above to check available slots.</div>';
  document.getElementById('reschedule-modal').classList.add('open');
}

function closeRescheduleModal() {
  document.getElementById('reschedule-modal').classList.remove('open');
  activeRescheduleAppId = null;
}

document.getElementById('reschedule-date').addEventListener('change', async (e) => {
  const date = e.target.value;
  if (!date || !rescheduleDoctorId) return;

  const box = document.getElementById('reschedule-slots-box');
  box.innerHTML = '<div style="color: var(--accent-teal);">Checking available slots...</div>';

  try {
    const res = await API.get(`/api/doctors/${rescheduleDoctorId}/slots?date=${date}`);
    if (!res.data.isAvailable || (res.data.slots || []).length === 0) {
      box.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.85rem;">${res.data.message || 'No available slots.'}</div>`;
      return;
    }

    box.innerHTML = res.data.slots.map(s => {
      if (!s.available) {
        return `<div class="slot-pill disabled">${s.time}</div>`;
      }
      return `<div class="slot-pill" id="rslot-${s.time.replace(':', '')}" onclick="pickRescheduleSlot('${s.time}')">${s.time}</div>`;
    }).join('');
  } catch (err) {
    box.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.85rem;">${err.message}</div>`;
  }
});

function pickRescheduleSlot(time) {
  chosenRescheduleTime = time;
  document.querySelectorAll('#reschedule-slots-box .slot-pill').forEach(el => el.classList.remove('selected'));
  const target = document.getElementById(`rslot-${time.replace(':', '')}`);
  if (target) target.classList.add('selected');
}

async function confirmReschedule() {
  const date = document.getElementById('reschedule-date').value;
  if (!date || !chosenRescheduleTime) {
    API.showToast('Please select both a new date and time slot.', 'warning');
    return;
  }

  try {
    await API.put(`/api/appointments/${activeRescheduleAppId}/reschedule`, {
      newDate: date,
      newTime: chosenRescheduleTime
    });

    API.showToast('Appointment rescheduled successfully!', 'success');
    closeRescheduleModal();
    await loadDashboardStats();
    await loadAppointments();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 4. Cancel Modal
function openCancelModal(appointmentId) {
  activeCancelAppId = appointmentId;
  document.getElementById('cancel-reason').value = '';
  document.getElementById('cancel-modal').classList.add('open');
}

function closeCancelModal() {
  document.getElementById('cancel-modal').classList.remove('open');
  activeCancelAppId = null;
}

async function confirmCancel() {
  const reason = document.getElementById('cancel-reason').value.trim();

  try {
    await API.patch(`/api/appointments/${activeCancelAppId}/cancel`, {
      reason: reason || 'Cancelled by patient'
    });

    API.showToast('Appointment cancelled. The slot has been released.', 'success');
    closeCancelModal();
    await loadDashboardStats();
    await loadAppointments();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 5. View Details Modal
function viewAppDetails(id) {
  const app = allAppointments.find(a => a._id === id);
  if (!app) return;

  const content = document.getElementById('details-modal-content');
  content.innerHTML = `
    <div style="font-size: 0.92rem; line-height: 1.7;">
      <strong>Appointment ID:</strong> ${app._id}<br>
      <strong>Doctor:</strong> ${app.doctorId?.name} (${app.doctorId?.specialization})<br>
      <strong>Department:</strong> ${app.departmentId?.departmentName}<br>
      <strong>Date & Time:</strong> ${app.appointmentDateString} at ${app.appointmentTime}<br>
      <strong>Status:</strong> <span class="badge ${app.status === 'Completed' ? 'badge-completed' : app.status === 'Cancelled' ? 'badge-cancelled' : 'badge-booked'}">${app.status}</span><br>
      <strong>Reason for Visit:</strong> ${app.reason}<br>
      <strong>Fee:</strong> ₹${app.doctorId?.consultationFee || 500}
      <hr style="margin: 0.85rem 0; border: none; border-top: 1px solid var(--border-color);">
      ${app.consultationNotes ? `<strong>Doctor Clinical Notes:</strong><br><p style="background: #f1f5f9; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem;">${app.consultationNotes}</p>` : ''}
      ${app.prescription ? `<strong>Prescription:</strong><br><p style="background: #e0f2fe; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem; color: var(--primary-navy);">💊 ${app.prescription}</p>` : ''}
      ${app.status === 'Cancelled' ? `<strong>Cancellation Audit:</strong><br><p style="background: #fff1f2; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem; color: #9f1239;">Cancelled by ${app.cancelledBy || 'User'}: ${app.cancelledReason || 'No reason provided'}</p>` : ''}
    </div>
  `;
  document.getElementById('details-modal').classList.add('open');
}

function closeDetailsModal() {
  document.getElementById('details-modal').classList.remove('open');
}

// 6. Profile Management
async function loadProfile() {
  try {
    const res = await API.get('/api/patients/profile');
    const p = res.data;

    document.getElementById('prof-name').value = p.name || '';
    document.getElementById('prof-email').value = p.email || '';
    document.getElementById('prof-phone').value = p.phone || '';
    document.getElementById('prof-gender').value = p.gender || 'Prefer not to say';
    document.getElementById('prof-blood').value = p.bloodGroup || 'Unknown';
    document.getElementById('prof-address').value = p.address || '';
    if (p.dateOfBirth) {
      document.getElementById('prof-dob').value = p.dateOfBirth.split('T')[0];
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('prof-name').value.trim();
  const phone = document.getElementById('prof-phone').value.trim();
  const gender = document.getElementById('prof-gender').value;
  const bloodGroup = document.getElementById('prof-blood').value;
  const address = document.getElementById('prof-address').value.trim();
  const dob = document.getElementById('prof-dob').value;

  try {
    const res = await API.put('/api/patients/profile', {
      name,
      phone,
      gender,
      bloodGroup,
      address,
      dateOfBirth: dob || undefined
    });

    const user = API.getUser();
    if (user) {
      user.name = res.data.name;
      API.setUser(user);
      document.getElementById('patient-name-display').textContent = user.name;
    }

    API.showToast('Profile updated successfully!', 'success');
  } catch (err) {
    API.showToast(err.message, 'error');
  }
});

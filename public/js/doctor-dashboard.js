/**
 * ApexCare Hospital Management System - Doctor Dashboard Controller
 */

let doctorAppointments = [];
let activeCompleteAppId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = API.getUser();
  if (user) {
    document.getElementById('doctor-name-display').textContent = user.name;
    document.getElementById('doctor-avatar-initial').textContent = user.name.replace('Dr. ', '')[0];
    document.getElementById('doctor-spec-display').textContent = user.specialization || 'Consultant Specialist';
  }

  await loadDoctorStats();
  await loadAppointments();
});

// Tab switcher
function showTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(`tab-${tabId}`);
  const targetLink = document.getElementById(`nav-${tabId}`);
  if (targetPane) targetPane.classList.add('active');
  if (targetLink) targetLink.classList.add('active');
}

// 1. Load Aggregated Schedule Stats
async function loadDoctorStats() {
  const user = API.getUser();
  if (!user) return;

  try {
    const res = await API.get(`/api/doctors/${user.id}/stats`);
    const s = res.data;

    document.getElementById('stat-total').textContent = s.totalAppointments || 0;
    document.getElementById('stat-today').textContent = s.todayBooked || 0;
    document.getElementById('stat-upcoming').textContent = s.upcomingBooked || 0;
    document.getElementById('stat-completed').textContent = s.completed || 0;
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 2. Load Appointments for this Doctor
async function loadAppointments() {
  const tbody = document.getElementById('doctor-appointments-tbody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading your schedule...</td></tr>`;

  try {
    const res = await API.get('/api/appointments');
    doctorAppointments = res.data || [];
    renderDoctorAppointments(doctorAppointments);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-rose); padding: 2rem;">${err.message}</td></tr>`;
  }
}

function renderDoctorAppointments(list) {
  const tbody = document.getElementById('doctor-appointments-tbody');

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">🩺</div>
            <div class="empty-title">No appointments in your queue</div>
            <p class="empty-desc">No consultations currently match your chosen filter criteria.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(app => {
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
          <strong>${app.patientId?.name || 'Patient'}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${app.patientId?.gender || 'N/A'} &bull; ${app.patientId?.phone || ''}</div>
        </td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${app.reason}">
          ${app.reason}
        </td>
        <td>
          <span class="badge ${badgeClass}">${app.status}</span>
        </td>
        <td>
          ${app.prescription ? '💊 Digital Rx' : '—'}
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-outline btn-sm" onclick="viewDoctorAppDetails('${app._id}')">Review</button>
            ${isBooked ? `
              <button class="btn btn-primary btn-sm" onclick="openCompleteModal('${app._id}', '${app.patientId?.name || 'Patient'}')">Complete Visit</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter doctor's appointments
function filterDoctorAppointments() {
  const statusFilter = document.getElementById('filter-doc-status').value;
  const dateFilter = document.getElementById('filter-doc-date').value;
  const searchPatient = document.getElementById('filter-doc-patient').value.toLowerCase().trim();

  let filtered = doctorAppointments;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  if (dateFilter) {
    filtered = filtered.filter(a => a.appointmentDateString === dateFilter);
  }

  if (searchPatient) {
    filtered = filtered.filter(a => (a.patientId?.name || '').toLowerCase().includes(searchPatient));
  }

  renderDoctorAppointments(filtered);
}

// 3. Complete Appointment Modal
function openCompleteModal(appointmentId, patientName) {
  activeCompleteAppId = appointmentId;
  document.getElementById('complete-patient-name').textContent = patientName;
  document.getElementById('consultation-notes').value = '';
  document.getElementById('consultation-prescription').value = '';
  document.getElementById('complete-modal').classList.add('open');
}

function closeCompleteModal() {
  document.getElementById('complete-modal').classList.remove('open');
  activeCompleteAppId = null;
}

async function confirmCompleteVisit() {
  const notes = document.getElementById('consultation-notes').value.trim();
  const prescription = document.getElementById('consultation-prescription').value.trim();

  try {
    await API.patch(`/api/appointments/${activeCompleteAppId}/complete`, {
      consultationNotes: notes,
      prescription
    });

    API.showToast('Consultation marked as Completed!', 'success');
    closeCompleteModal();
    await loadDoctorStats();
    await loadAppointments();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 4. View Details Modal
function viewDoctorAppDetails(id) {
  const app = doctorAppointments.find(a => a._id === id);
  if (!app) return;

  const content = document.getElementById('doc-details-content');
  content.innerHTML = `
    <div style="font-size: 0.92rem; line-height: 1.7;">
      <strong>Appointment ID:</strong> ${app._id}<br>
      <strong>Patient Name:</strong> ${app.patientId?.name || 'Patient'}<br>
      <strong>Contact:</strong> ${app.patientId?.phone || 'N/A'} &bull; ${app.patientId?.email || 'N/A'}<br>
      <strong>Blood Group:</strong> ${app.patientId?.bloodGroup || 'Unknown'}<br>
      <strong>Date & Slot:</strong> ${app.appointmentDateString} at ${app.appointmentTime}<br>
      <strong>Status:</strong> <span class="badge ${app.status === 'Completed' ? 'badge-completed' : app.status === 'Cancelled' ? 'badge-cancelled' : 'badge-booked'}">${app.status}</span><br>
      <strong>Primary Reason:</strong> ${app.reason}
      <hr style="margin: 0.85rem 0; border: none; border-top: 1px solid var(--border-color);">
      ${app.consultationNotes ? `<strong>Consultation Diagnosis & Notes:</strong><br><p style="background: #f1f5f9; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem;">${app.consultationNotes}</p>` : '<em>No consultation notes recorded yet.</em><br>'}
      ${app.prescription ? `<strong>Prescribed Medication:</strong><br><p style="background: #e0f2fe; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem; color: var(--primary-navy);">💊 ${app.prescription}</p>` : ''}
      ${app.status === 'Cancelled' ? `<strong>Cancellation Trace:</strong><br><p style="background: #fff1f2; padding: 0.6rem; border-radius: var(--radius-sm); margin-top: 0.25rem; color: #9f1239;">Cancelled by ${app.cancelledBy}: ${app.cancelledReason}</p>` : ''}
    </div>
  `;
  document.getElementById('doc-details-modal').classList.add('open');
}

function closeDoctorDetailsModal() {
  document.getElementById('doc-details-modal').classList.remove('open');
}

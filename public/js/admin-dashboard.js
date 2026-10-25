/**
 * ApexCare Hospital Management System - Administrator Dashboard Controller
 * Powers full administrative visibility, department management, doctor provisioning, and MongoDB aggregations.
 */

let allAdminAppointments = [];
let allAdminDoctors = [];
let allAdminDepartments = [];
let allAdminPatients = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = API.getUser();
  if (user) {
    document.getElementById('admin-name-display').textContent = user.name;
  }

  await loadAdminStats();
  await loadDepartmentsTab();
  await loadDoctorsTab();
  await loadPatientsTab();
  await loadAppointmentsTab();
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

// 1. Load Aggregation Dashboard Stats
async function loadAdminStats() {
  try {
    const res = await API.get('/api/admin/dashboard-stats');
    const { summary, departmentDistribution, recentAppointments } = res.data;

    // Primary metrics
    document.getElementById('stat-patients').textContent = summary.totalPatients || 0;
    document.getElementById('stat-doctors').textContent = `${summary.activeDoctors} / ${summary.totalDoctors}`;
    document.getElementById('stat-depts').textContent = summary.totalDepartments || 0;
    document.getElementById('stat-appointments').textContent = summary.totalAppointments || 0;

    // Sub-status metrics
    document.getElementById('stat-booked').textContent = summary.bookedAppointments || 0;
    document.getElementById('stat-completed').textContent = summary.completedAppointments || 0;
    document.getElementById('stat-cancelled').textContent = summary.cancelledAppointments || 0;

    // Render Department Aggregation Distribution
    const distTbody = document.getElementById('dept-dist-tbody');
    if (distTbody) {
      if (departmentDistribution.length === 0) {
        distTbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No appointment records yet.</td></tr>`;
      } else {
        distTbody.innerHTML = departmentDistribution.map(d => `
          <tr>
            <td><strong>${d.department}</strong></td>
            <td><span class="badge badge-booked">${d.appointments} appointment(s)</span></td>
          </tr>
        `).join('');
      }
    }

    // Render Recent Appointments
    const recentTbody = document.getElementById('recent-apps-tbody');
    if (recentTbody) {
      recentTbody.innerHTML = recentAppointments.map(a => `
        <tr>
          <td>${a.appointmentDateString} ${a.appointmentTime}</td>
          <td>${a.patientId?.name || 'Patient'}</td>
          <td>${a.doctorId?.name || 'Doctor'}</td>
          <td><span class="badge ${a.status === 'Completed' ? 'badge-completed' : a.status === 'Cancelled' ? 'badge-cancelled' : 'badge-booked'}">${a.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 2. Department Management Tab
async function loadDepartmentsTab() {
  const tbody = document.getElementById('admin-depts-tbody');
  const select = document.getElementById('new-doc-dept');

  try {
    const res = await API.get('/api/departments?includeInactive=true');
    allAdminDepartments = res.data || [];

    tbody.innerHTML = allAdminDepartments.map(d => `
      <tr>
        <td><strong>${d.departmentName}</strong></td>
        <td style="max-width: 300px; font-size: 0.88rem; color: var(--text-muted);">${d.description}</td>
        <td><strong>${d.doctorCount || 0}</strong> doctor(s)</td>
        <td><span class="badge ${d.isActive ? 'badge-active' : 'badge-inactive'}">${d.isActive ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn ${d.isActive ? 'btn-outline-danger' : 'btn-outline'} btn-sm"
                  style="${d.isActive ? '' : 'color: #166534; border-color: #86efac; background-color: #f0fdf4;'}"
                  onclick="toggleDepartmentStatus('${d._id}')">
            ${d.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>
    `).join('');

    // Also populate doctor creation modal select dropdown
    if (select) {
      select.innerHTML = '<option value="">-- Choose Department --</option>' +
        allAdminDepartments.filter(d => d.isActive).map(d => `<option value="${d._id}">${d.departmentName}</option>`).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--accent-rose);">${err.message}</td></tr>`;
  }
}

function openAddDeptModal() {
  document.getElementById('new-dept-name').value = '';
  document.getElementById('new-dept-desc').value = '';
  document.getElementById('add-dept-modal').classList.add('open');
}

function closeAddDeptModal() {
  document.getElementById('add-dept-modal').classList.remove('open');
}

async function submitCreateDepartment(e) {
  e.preventDefault();
  const name = document.getElementById('new-dept-name').value.trim();
  const desc = document.getElementById('new-dept-desc').value.trim();

  try {
    await API.post('/api/departments', {
      departmentName: name,
      description: desc
    });
    API.showToast(`Department '${name}' created successfully!`, 'success');
    closeAddDeptModal();
    await loadDepartmentsTab();
    await loadAdminStats();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function toggleDepartmentStatus(id) {
  try {
    const res = await API.patch(`/api/departments/${id}/toggle-status`);
    API.showToast(res.message, 'success');
    await loadDepartmentsTab();
    await loadDoctorsTab();
    await loadAdminStats();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function deactivateDepartment(id, name) {
  return toggleDepartmentStatus(id);
}

// 3. Doctor Management Tab
async function loadDoctorsTab() {
  const tbody = document.getElementById('admin-docs-tbody');

  try {
    const res = await API.get('/api/doctors?limit=50&includeInactive=true');
    allAdminDoctors = res.data || [];

    tbody.innerHTML = allAdminDoctors.map(doc => `
      <tr>
        <td><strong>${doc.name}</strong></td>
        <td>${doc.email}</td>
        <td>${doc.specialization}</td>
        <td>${doc.departmentId?.departmentName || 'General'}</td>
        <td>₹${doc.consultationFee}</td>
        <td>
          <span class="badge ${doc.availability === 'active' ? 'badge-active' : 'badge-inactive'}">
            ${doc.availability === 'active' ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="btn ${doc.availability === 'active' ? 'btn-outline-danger' : 'btn-outline'} btn-sm"
                  style="${doc.availability === 'active' ? '' : 'color: #166534; border-color: #86efac; background-color: #f0fdf4;'}"
                  onclick="toggleDoctorStatus('${doc._id}')">
            ${doc.availability === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: var(--accent-rose);">${err.message}</td></tr>`;
  }
}

function openAddDoctorModal() {
  document.getElementById('add-doctor-modal').classList.add('open');
}

function closeAddDoctorModal() {
  document.getElementById('add-doctor-modal').classList.remove('open');
}

async function submitCreateDoctor(e) {
  e.preventDefault();

  const name = document.getElementById('new-doc-name').value.trim();
  const email = document.getElementById('new-doc-email').value.trim();
  const phone = document.getElementById('new-doc-phone').value.trim();
  const password = document.getElementById('new-doc-pass').value;
  const spec = document.getElementById('new-doc-spec').value.trim();
  const deptId = document.getElementById('new-doc-dept').value;
  const exp = Number(document.getElementById('new-doc-exp').value);
  const fee = Number(document.getElementById('new-doc-fee').value);

  try {
    await API.post('/api/doctors', {
      name,
      email,
      phone,
      password,
      specialization: spec,
      departmentId: deptId,
      experienceYears: exp,
      consultationFee: fee
    });

    API.showToast(`Doctor account created successfully for ${name}!`, 'success');
    closeAddDoctorModal();
    await loadDoctorsTab();
    await loadDepartmentsTab();
    await loadAdminStats();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function toggleDoctorStatus(id) {
  try {
    const res = await API.patch(`/api/doctors/${id}/toggle-status`);
    API.showToast(res.message, 'success');
    await loadDoctorsTab();
    await loadDepartmentsTab();
    await loadAdminStats();
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// 4. Patients Tab
async function loadPatientsTab() {
  const tbody = document.getElementById('admin-patients-tbody');

  try {
    const res = await API.get('/api/patients?limit=50');
    allAdminPatients = res.data || [];

    tbody.innerHTML = allAdminPatients.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.email}</td>
        <td>${p.phone}</td>
        <td>${p.gender || 'N/A'}</td>
        <td><span class="badge badge-booked">${p.bloodGroup || 'Unknown'}</span></td>
        <td>${p.address || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-rose);">${err.message}</td></tr>`;
  }
}

// 5. Master Appointments Tab
async function loadAppointmentsTab() {
  const tbody = document.getElementById('admin-apps-tbody');

  try {
    const res = await API.get('/api/appointments?limit=100');
    allAdminAppointments = res.data || [];
    renderMasterAppointments(allAdminAppointments);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-rose);">${err.message}</td></tr>`;
  }
}

function renderMasterAppointments(list) {
  const tbody = document.getElementById('admin-apps-tbody');

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No matching appointments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => `
    <tr>
      <td>
        <strong>${a.appointmentDateString}</strong>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${a.appointmentTime}</div>
      </td>
      <td>
        <strong>${a.patientId?.name || 'Patient'}</strong>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${a.patientId?.phone || ''}</div>
      </td>
      <td>
        <strong>${a.doctorId?.name || 'Doctor'}</strong>
        <div style="font-size: 0.8rem; color: var(--accent-teal);">${a.departmentId?.departmentName || ''}</div>
      </td>
      <td style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.reason}">
        ${a.reason}
      </td>
      <td>
        <span class="badge ${a.status === 'Completed' ? 'badge-completed' : a.status === 'Cancelled' ? 'badge-cancelled' : 'badge-booked'}">
          ${a.status}
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="adminViewApp('${a._id}')">View</button>
      </td>
    </tr>
  `).join('');
}

function filterMasterAppointments() {
  const statusFilter = document.getElementById('filter-admin-status').value;
  const searchKey = document.getElementById('filter-admin-search').value.toLowerCase().trim();

  let filtered = allAdminAppointments;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  if (searchKey) {
    filtered = filtered.filter(a =>
      (a.patientId?.name || '').toLowerCase().includes(searchKey) ||
      (a.doctorId?.name || '').toLowerCase().includes(searchKey) ||
      (a.departmentId?.departmentName || '').toLowerCase().includes(searchKey)
    );
  }

  renderMasterAppointments(filtered);
}

function adminViewApp(id) {
  const app = allAdminAppointments.find(a => a._id === id);
  if (!app) return;

  alert(`Appointment ID: ${app._id}\nPatient: ${app.patientId?.name}\nDoctor: ${app.doctorId?.name}\nDate: ${app.appointmentDateString} at ${app.appointmentTime}\nStatus: ${app.status}\nReason: ${app.reason}\n${app.consultationNotes ? 'Notes: ' + app.consultationNotes : ''}\n${app.cancelledReason ? 'Cancelled Reason: ' + app.cancelledReason : ''}`);
}

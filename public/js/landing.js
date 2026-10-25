/**
 * ApexCare Hospital Management System - Landing Page Script
 * Loads real-time departments and doctors from MongoDB
 */

document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();
});
async function loadDepartments() {
  const container = document.getElementById('departments-grid');
  if (!container) return;

  try {
    const res = await API.get('/api/departments');
    if (!res.data || res.data.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No departments found.</p></div>`;
      return;
    }

    container.innerHTML = res.data.map((dept) => {
      return `
        <div class="card dept-card">
          <h3 class="dept-name">${dept.departmentName}</h3>
          <p class="dept-desc">${dept.description}</p>
          <div class="dept-meta">
            <span>${dept.doctorCount || 0} Specialist Doctor(s)</span>
            <a href="/book-appointment.html?dept=${dept._id}" class="btn btn-outline btn-sm">Consult &rarr;</a>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Unable to load departments: ${err.message}</p></div>`;
  }
}


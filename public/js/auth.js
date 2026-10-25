/**
 * ApexCare Hospital Management System - Authentication Guard and Navbar Syncer
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = API.getUser();
  const token = API.getToken();

  // 1. Update Navigation Bar if user is logged in
  const authNavContainer = document.getElementById('nav-auth-actions');
  if (authNavContainer) {
    if (token && user) {
      let dashboardUrl = '/patient-dashboard.html';
      if (user.role === 'doctor') dashboardUrl = '/doctor-dashboard.html';
      if (user.role === 'admin') dashboardUrl = '/admin-dashboard.html';

      authNavContainer.innerHTML = `
        <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-muted); margin-right: 0.5rem;">
          Hi, ${user.name.split(' ')[0]} (${user.role})
        </span>
        <a href="${dashboardUrl}" class="btn btn-primary btn-sm">Dashboard</a>
        <button onclick="API.logout()" class="btn btn-outline btn-sm">Logout</button>
      `;
    } else {
      authNavContainer.innerHTML = `
        <a href="/login.html" class="btn btn-outline btn-sm">Login</a>
        <a href="/register.html" class="btn btn-primary btn-sm">Register</a>
      `;
    }
  }

  // 2. Client-side Route Guard for Protected Dashboard Pages
  const currentPath = window.location.pathname.toLowerCase();

  const isPatientDashboard = currentPath.includes('patient-dashboard');
  const isDoctorDashboard = currentPath.includes('doctor-dashboard');
  const isAdminDashboard = currentPath.includes('admin-dashboard');
  const isBookAppointment = currentPath.includes('book-appointment');

  if (isPatientDashboard || isDoctorDashboard || isAdminDashboard || isBookAppointment) {
    if (!token || !user) {
      API.showToast('Authentication required. Redirecting to login...', 'warning');
      setTimeout(() => {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1000);
      return;
    }

    // Role Enforcement
    if (isBookAppointment && user.role !== 'patient') {
      API.showToast(`Access denied: Only patients can book appointments. Redirecting to your dashboard...`, 'warning');
      setTimeout(() => {
        window.location.href = user.role === 'admin' ? '/admin-dashboard.html' : '/doctor-dashboard.html';
      }, 1200);
      return;
    }

    if (isPatientDashboard && user.role !== 'patient') {
      API.showToast(`Access denied: You are logged in as a ${user.role}.`, 'error');
      setTimeout(() => {
        window.location.href = user.role === 'doctor' ? '/doctor-dashboard.html' : '/admin-dashboard.html';
      }, 1500);
      return;
    }

    if (isDoctorDashboard && user.role !== 'doctor') {
      API.showToast(`Access denied: You are logged in as a ${user.role}.`, 'error');
      setTimeout(() => {
        window.location.href = user.role === 'patient' ? '/patient-dashboard.html' : '/admin-dashboard.html';
      }, 1500);
      return;
    }

    if (isAdminDashboard && user.role !== 'admin') {
      API.showToast(`Access denied: Administrator privileges required.`, 'error');
      setTimeout(() => {
        window.location.href = user.role === 'patient' ? '/patient-dashboard.html' : '/doctor-dashboard.html';
      }, 1500);
      return;
    }
  }

  // Hide booking links on general pages for Admin and Doctor accounts
  if (token && user && user.role !== 'patient') {
    document.querySelectorAll('a[href*="book-appointment"]').forEach(el => {
      el.style.display = 'none';
    });
  }
});

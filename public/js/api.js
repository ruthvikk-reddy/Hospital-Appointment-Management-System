/**
 * ApexCare Hospital Management System - Frontend API Client
 * Manages HTTP communications, authentication state, and UI feedback notifications.
 */

const API = {
  // Store authentication credentials in localStorage
  getToken() {
    return localStorage.getItem('apex_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('apex_token', token);
    } else {
      localStorage.removeItem('apex_token');
    }
  },

  getUser() {
    const raw = localStorage.getItem('apex_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('apex_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('apex_user');
    }
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  logout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      this.setToken(null);
      this.setUser(null);
      window.location.href = '/login.html';
    });
  },

  // Central fetch wrapper
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Handle session expiration
        if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
          this.showToast('Your session has expired. Please log in again.', 'warning');
          setTimeout(() => {
            this.setToken(null);
            this.setUser(null);
            window.location.href = '/login.html';
          }, 1500);
        }

        const errorMessage = (data && data.message) || `HTTP Error ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // Interactive Toast Notifications
  showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

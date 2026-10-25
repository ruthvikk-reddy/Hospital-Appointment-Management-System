/**
 * Helper utilities for formatting and validation
 */

/**
 * Format ISO Date string to human readable format (e.g., Oct 15, 2026)
 */
const formatReadableDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format 24hr time (e.g. 14:30) to 12hr AM/PM format (e.g. 02:30 PM)
 */
const format12HourTime = (time24) => {
  if (!time24 || !time24.includes(':')) return time24;
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Sanitize search inputs to prevent regex injection or NoSQL injection
 */
const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

module.exports = {
  formatReadableDate,
  format12HourTime,
  escapeRegex
};

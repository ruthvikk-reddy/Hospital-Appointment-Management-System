/**
 * Centralized error handling middleware.
 * Formats Mongoose errors, duplicate keys, and unexpected server exceptions
 * into clean, user-friendly JSON responses without exposing internal stack traces.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier format for '${err.path}'`;
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    
    if (field === 'unique_active_doctor_slot' || (err.keyPattern && err.keyPattern.doctorId)) {
      message = 'This doctor already has a booked appointment at the requested date and time slot.';
    } else {
      message = `A record with this ${field} ('${value}') already exists. Please choose another.`;
    }
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join('. ');
  }

  // Handle JWT Error
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  }

  // Log in non-test mode
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 Route Not Found handler
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found at endpoint ${req.method} ${req.originalUrl}`
  });
};

module.exports = { errorHandler, notFound };

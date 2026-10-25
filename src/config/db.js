const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * Supports connection retry and clean status reporting.
 */
let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_management';
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    });

    isConnected = true;
    console.log(`[MongoDB Connected]: Host -> ${conn.connection.host}, Database -> ${conn.connection.name}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    // We do NOT exit the process immediately so that frontend can still serve friendly offline status
    // and instruct the student on configuring MongoDB Atlas or starting local MongoDB
    return null;
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[MongoDB Disconnected]: Lost connection to database.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[MongoDB Reconnected]: Successfully restored database connection.');
});

const getDBStatus = () => {
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  return {
    state: states[mongoose.connection.readyState] || 'Unknown',
    readyState: mongoose.connection.readyState,
    isConnected: mongoose.connection.readyState === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

module.exports = { connectDB, getDBStatus };

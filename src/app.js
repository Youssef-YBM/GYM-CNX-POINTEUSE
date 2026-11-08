const express = require('express');
require('dotenv').config();

const memberRoutes = require('./routes/memberRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes'); // Add this line
const shiftsRoutes = require('./routes/shiftsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  next();
});


// Routes
app.use('/api/members', memberRoutes);
app.use('/api/attendance', attendanceRoutes); // Add this line
app.use('/api/shifts', shiftsRoutes);
// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Multi-Device Member Management API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    NETWORK_TIMEOUT: process.env.NETWORK_TIMEOUT
  });
});



// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: {
      health: 'GET /health',
      members: 'GET /api/members/*'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Multi-Device Member API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
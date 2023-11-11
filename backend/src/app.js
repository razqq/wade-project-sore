const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes
const myRoutes = require('./api/v1/routes/myRoutes');

// Use routes
app.use('/api/v1', myRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).send('Something broke!');
});

module.exports = app;
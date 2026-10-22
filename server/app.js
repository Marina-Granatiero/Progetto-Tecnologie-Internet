// Costruzione dell'applicazione Express (separata da index.js per poterla testare).
const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settoriRoutes = require('./routes/settoriRoutes');

const app = express();
app.disable('x-powered-by');

// Middleware globali
app.use(cors(config.clientOrigin ? { origin: config.clientOrigin } : undefined));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});
app.use(express.json({ limit: '10kb' }));

// Stato del servizio e del database
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'raggiungibile' });
  } catch {
    res.status(503).json({ status: 'errore', database: 'non raggiungibile' });
  }
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/ordini', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', settoriRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;

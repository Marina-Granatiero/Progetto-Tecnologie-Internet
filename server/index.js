const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Rotte API
app.use('/api/auth', authRoutes);
app.use('/api/ordini', orderRoutes);

// Endpoint disponibilità settori
app.get('/api/settori', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id_settore,
        s.nome_settore,
        s.prezzo,
        s.capacita_max,
        COUNT(CASE WHEN b.venduto = 0 THEN 1 END) AS biglietti_disponibili
      FROM settori s
      LEFT JOIN biglietti b ON s.id_settore = b.fk_settore
      GROUP BY s.id_settore, s.nome_settore, s.prezzo, s.capacita_max
      ORDER BY s.id_settore ASC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Errore query settori:', err);
    res.status(500).json({ error: 'Errore nel recupero dei settori' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server HTTP in ascolto sulla porta ${PORT}`);
});
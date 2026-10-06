const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware per richieste cross-origin e parsing JSON
app.use(cors());
app.use(express.json());

// Endpoint di test per verificare lo stato del server
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server attivo e funzionante' });
});

// Endpoint REST: Elenco dei settori con il numero di biglietti disponibili
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
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Errore durante il recupero dei settori:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Avvio del server HTTP e verifica connessione al database
app.listen(PORT, async () => {
  console.log(`Server HTTP in ascolto sulla porta ${PORT}`);
  try {
    await db.query('SELECT 1');
    console.log('Connessione al database MySQL stabilita con successo.');
  } catch (err) {
    console.error('Impossibile connettersi al database MySQL:', err.message);
  }
});
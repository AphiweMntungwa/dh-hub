// In routes/users.js
import express from 'express';
const router = express.Router();
import db from '../db.js';

router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM aspnetusers');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

export default router;

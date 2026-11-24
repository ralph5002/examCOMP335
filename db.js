// db.js - one shared Postgres connection for the whole app.
// It also creates the two exam tables and the starter rows (janedoe, yoda,
// and janedoe's first assignment) the first time the app starts.
require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';

const pool = new Pool({
  connectionString: url,
  // Render's public (External) address needs SSL. localhost and Render's Internal address do not.
  ssl: url.includes('render.com') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.log('Database connection error:', err.message));

async function setupDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS examusers (
    "id" serial primary key, username text, password text, isAdmin text)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS assignment (
    "id" serial primary key, username text, description text, due date)`);

  // Password for both accounts is: hello
  await pool.query(`INSERT INTO examusers (username, password, isAdmin)
    SELECT 'janedoe', '$2a$10$tXMKF036p0ZYIxF/cJEHauw/TFrcho4DXy41Kt12D3Lbnzr221hmK', 'student'
    WHERE NOT EXISTS (SELECT 1 FROM examusers WHERE username = 'janedoe')`);
  await pool.query(`INSERT INTO examusers (username, password, isAdmin)
    SELECT 'yoda', '$2a$10$dxRF9y4FyqQ90M93xha6GO1ZifqHUC/L3HI6KWoTJv91nI0c4lxfC', 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM examusers WHERE username = 'yoda')`);
  await pool.query(`INSERT INTO assignment (username, description, due)
    SELECT 'janedoe', 'Finish authentication exercise', '2026-11-12'
    WHERE NOT EXISTS (SELECT 1 FROM assignment WHERE username = 'janedoe')`);
}

setupDatabase()
  .then(() => console.log('Database ready'))
  .catch((err) => console.log('Database setup failed:', err.message));

module.exports = pool;

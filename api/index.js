import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize pool outside of request handlers
const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 20000, // Reduced idle timeout
  connectionTimeoutMillis: 5000, // Added connection timeout
  statement_timeout: 4000, // Added query timeout
  query_timeout: 4000 // Added query timeout
});

// Warm up pool with initial connection
let warmupPromise = pool.connect().then(client => {
  client.release();
  console.log('DB connection pool warmed up');
}).catch(err => {
  console.error('Initial pool warmup failed:', err);
});

// Routes with timeout handling
app.get("/", async (req, res) => {
  const timeout = setTimeout(() => {
    res.status(503).render('error', { 
      error: 'Service temporarily unavailable. Please try again.' 
    });
  }, 8000); // 8 second timeout

  let client;
  try {
    // Wait for warmup to complete first
    await warmupPromise;
    
    client = await pool.connect();
    const query = await client.query("SELECT * FROM list_items ORDER BY id LIMIT 50");
    
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      res.render('index', { 
        listTitle: "Today",
        listItems: query.rows 
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("Error:", err);
    
    if (!res.headersSent) {
      res.render('error', { 
        error: 'Database error. Please try again.' 
      });
    }
  } finally {
    if (client) {
      client.release(true); // Force release
    }
  }
});

// Quick health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Simplified API endpoint with timeout
app.get("/api/items", async (req, res) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  }, 8000);

  let client;
  try {
    client = await pool.connect();
    const query = await client.query("SELECT * FROM list_items ORDER BY id LIMIT 50");
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      res.json({ listItems: query.rows });
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("API Error:", err);
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Database error' });
    }
  } finally {
    if (client) {
      client.release(true);
    }
  }
});

export default app;
// api/index.js
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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Detailed connection configuration
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  ssl: true,
  connectionTimeoutMillis: 10000,
};

// Log database configuration (excluding sensitive data)
console.log('Database Config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  ssl: dbConfig.ssl
});

const pool = new pg.Pool(dbConfig);

// Test database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Main route with better error handling
app.get("/", async (req, res) => {
  let client;
  
  try {
    // Test connection first
    client = await pool.connect();
    console.log('Successfully connected to database');
    
    // Simple query to test database
    const testQuery = await client.query('SELECT NOW()');
    console.log('Test query successful:', testQuery.rows[0]);
    
    // Main query
    const items = await client.query("SELECT * FROM list_items ORDER BY id LIMIT 50");
    console.log(`Retrieved ${items.rows.length} items from database`);
    
    res.render('index', { 
      listTitle: "Today",
      listItems: items.rows 
    });
    
  } catch (err) {
    console.error('Detailed error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
    let errorMessage;
    switch(err.code) {
      case 'ECONNREFUSED':
        errorMessage = 'Unable to connect to database server';
        break;
      case '28P01':
        errorMessage = 'Database authentication failed';
        break;
      case '3D000':
        errorMessage = 'Database does not exist';
        break;
      case '42P01':
        errorMessage = 'Table does not exist';
        break;
      default:
        errorMessage = `Database error (${err.code}): ${err.message}`;
    }
    
    res.render('error', { 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
    
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ 
      status: "ok",
      timestamp: result.rows[0].now,
      database: "connected"
    });
  } catch (err) {
    res.status(500).json({ 
      status: "error",
      message: err.message,
      code: err.code
    });
  }
});

export default app;

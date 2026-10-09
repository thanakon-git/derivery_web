import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration options
const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'defaultdb';
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUri = process.env.MYSQL_URL || process.env.DATABASE_URL;

// SSL configuration (Required for Aiven Cloud MySQL)
const useSSL = process.env.DB_SSL === 'true' || 
               process.env.DB_SSL === 'REQUIRED' || 
               (dbUri && dbUri.includes('ssl-mode=REQUIRED')) ||
               (dbHost && dbHost.includes('aivencloud.com'));

export let pool: Pool;

if (dbUri) {
  try {
    const parsed = new URL(dbUri);
    pool = mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  } catch {
    pool = mysql.createPool({
      uri: dbUri,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
} else {
  // If user provided separate credentials
  pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

/**
 * Initialize database schema and seed initial data if tables are empty.
 */
export async function initDatabase(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ [MySQL Pool] Connected successfully to database: ${dbName} at ${dbHost}:${dbPort}`);

    // 1. Create customers table (if not already view or table)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          address TEXT NOT NULL,
          lat DECIMAL(10, 7) NOT NULL,
          lng DECIMAL(10, 7) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {}

    // 2. Create riders table (if not already view or table)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS riders (
          id VARCHAR(50) PRIMARY KEY,
          rider_number INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          color VARCHAR(20) NOT NULL
        )
      `);
    } catch {}

    // 3. Create orders table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(100) PRIMARY KEY,
          order_number VARCHAR(50) NOT NULL,
          customer_id VARCHAR(50) NOT NULL,
          box_count INT NOT NULL DEFAULT 1,
          price_per_box DECIMAL(10, 2) DEFAULT 65.00,
          cost_per_box DECIMAL(10, 2) DEFAULT 40.00,
          status VARCHAR(30) DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {}

    // 4. Create delivery_plans table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS delivery_plans (
          id VARCHAR(100) PRIMARY KEY,
          departure_time VARCHAR(20) DEFAULT '11:30',
          deadline_time VARCHAR(20) DEFAULT '12:30',
          optimization_strategy VARCHAR(50) NOT NULL,
          total_orders INT NOT NULL DEFAULT 0,
          total_boxes INT NOT NULL DEFAULT 0,
          total_riders_used INT NOT NULL DEFAULT 0,
          total_distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
          max_trip_duration_minutes INT NOT NULL DEFAULT 0,
          is_all_within_deadline BOOLEAN DEFAULT TRUE,
          total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
          total_food_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
          total_rider_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
          net_profit DECIMAL(10, 2) NOT NULL DEFAULT 0,
          profit_margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
          plan_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {}

    // 5. Create delivery_jobs table (if not exists)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS delivery_jobs (
          id VARCHAR(100) PRIMARY KEY,
          job_code VARCHAR(50) NOT NULL,
          rider_id VARCHAR(50) NOT NULL,
          plan_id VARCHAR(100) NOT NULL,
          total_boxes INT NOT NULL DEFAULT 0,
          total_distance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          delivery_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
          departure_time VARCHAR(20) DEFAULT '11:30',
          completion_time VARCHAR(20) DEFAULT '12:30',
          status VARCHAR(30) DEFAULT 'ASSIGNED',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {}

    // 6. Create delivery_routes table (if not exists)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS delivery_routes (
          id VARCHAR(100) PRIMARY KEY,
          job_id VARCHAR(100) NOT NULL,
          order_id VARCHAR(100) NOT NULL,
          sequence_number INT NOT NULL,
          distance_from_prev DECIMAL(10, 2) NOT NULL DEFAULT 0,
          estimated_arrival_minutes INT NOT NULL DEFAULT 0,
          google_maps_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {}

    // 5. Seed customers if empty
    const [custRows]: any = await conn.query('SELECT COUNT(*) as count FROM customers');
    if (custRows[0].count === 0) {
      console.log('🌱 Seeding 30 initial customers around MSU...');
      const { INITIAL_CUSTOMERS } = await import('./database/seed');
      for (const c of INITIAL_CUSTOMERS) {
        await conn.query(
          'INSERT IGNORE INTO customers (id, name, phone, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
          [c.id, c.name, c.phone, c.address, c.lat, c.lng]
        );
      }
      console.log('✅ 30 Customers seeded successfully!');
    }

    // 6. Seed riders if empty
    const [riderRows]: any = await conn.query('SELECT COUNT(*) as count FROM riders');
    if (riderRows[0].count === 0) {
      console.log('🌱 Seeding 15 initial riders with color palette...');
      const { CONFIG } = await import('./config');
      for (let i = 0; i < 15; i++) {
        const id = `RIDER-${(i + 1).toString().padStart(2, '0')}`;
        const name = `ไรเดอร์ ${i + 1}`;
        const phone = `08${(i + 1).toString().padStart(2, '0')}-999-8888`;
        const color = CONFIG.RIDER_PALETTE[i % CONFIG.RIDER_PALETTE.length];
        await conn.query(
          'INSERT IGNORE INTO riders (id, rider_number, name, phone, color) VALUES (?, ?, ?, ?, ?)',
          [id, i + 1, name, phone, color]
        );
      }
      console.log('✅ 15 Riders seeded successfully!');
    }

    conn.release();
    return true;
  } catch (err: any) {
    console.warn(`⚠️ [MySQL Pool Warning] Could not connect to MySQL database: ${err.message}`);
    console.warn(`👉 Please check your credentials in backend/.env (Aiven or Local MySQL)`);
    return false;
  }
}

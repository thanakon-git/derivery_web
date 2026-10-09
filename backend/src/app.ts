import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { customerRouter } from './controllers/customer.controller';
import { orderRouter } from './controllers/order.controller';
import { routeRouter } from './controllers/route.controller';
import { CONFIG } from './config';

const app: Application = express();

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Root Route - Interactive Landing Page & API Explorer
app.get('/', (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
    return res.json({
      status: 'online',
      system: 'Smart Lunchbox Delivery Routing System (MSU Area)',
      database: 'Aiven Cloud MySQL',
      endpoints: {
        health: '/api/health',
        customers_nearby_1km: '/api/customers/nearby?radius=1',
        orders_nearby_2km: '/api/orders/nearby?radius=2',
        all_customers: '/api/customers',
        all_orders: '/api/orders',
        all_riders: '/api/riders',
        delivery_plan: '/api/routes/plan'
      }
    });
  }

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Lunchbox Delivery API - MSU Area (HW-5)</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      width: 100%;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 36px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .dot {
      width: 10px;
      height: 10px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 10px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    h1 {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(to right, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    p.subtitle {
      color: #94a3b8;
      font-size: 1.05rem;
      margin-bottom: 28px;
      line-height: 1.6;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .info-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 16px 20px;
      border-radius: 14px;
    }
    .info-card .label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-card .value { font-size: 1.05rem; font-weight: 600; color: #e2e8f0; margin-top: 4px; }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 14px 18px;
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    .endpoint-item:hover {
      background: rgba(56, 189, 248, 0.08);
      border-color: rgba(56, 189, 248, 0.3);
      transform: translateY(-1px);
    }
    .method-get {
      background: #0284c7;
      color: white;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 6px;
      margin-right: 8px;
    }
    .endpoint-path {
      font-family: monospace;
      color: #e2e8f0;
      font-size: 0.95rem;
      word-break: break-all;
    }
    .endpoint-desc {
      color: #94a3b8;
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .btn-test {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: white;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn-test:hover { opacity: 0.9; }
    footer {
      margin-top: 32px;
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-status">
      <span class="dot"></span>
      Render Web Service is Live & MySQL Connected
    </div>
    <h1>🍱 Smart Lunchbox Delivery API</h1>
    <p class="subtitle">ระบบจัดส่งอาหารกล่องอัจฉริยะ & Route Optimization (MSU Area) — วิชา Web Application (HW-5)</p>

    <div class="info-grid">
      <div class="info-card">
        <div class="label">ฐานข้อมูลคลาวด์</div>
        <div class="value">Aiven Cloud MySQL</div>
      </div>
      <div class="info-card">
        <div class="label">พิกัดร้านอาหาร (Depot)</div>
        <div class="value">16.2452° N, 103.2501° E</div>
      </div>
      <div class="info-card">
        <div class="label">เวลาเริ่มส่ง / สิ้นสุด</div>
        <div class="value">11:30 - 12:30 น. (60 นาที)</div>
      </div>
    </div>

    <div class="section-title">📌 Mandatory Endpoints (เกณฑ์ตรวจการบ้าน HW-5)</div>
    <div class="endpoint-list">
      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/customers/nearby?radius=1</span>
          <div class="endpoint-desc">📍 ค้นหาลูกค้าในรัศมี 1 กม. จากร้านอาหาร (คำนวณด้วย Haversine Formula)</div>
        </div>
        <a class="btn-test" href="/api/customers/nearby?radius=1" target="_blank">เปิดดู JSON ↗</a>
      </div>

      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/orders/nearby?radius=2</span>
          <div class="endpoint-desc">📦 ค้นหาออเดอร์ในรัศมี 2 กม. พร้อมข้อมูลลูกค้าและพิกัด</div>
        </div>
        <a class="btn-test" href="/api/orders/nearby?radius=2" target="_blank">เปิดดู JSON ↗</a>
      </div>

      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/health</span>
          <div class="endpoint-desc">🩺 ตรวจสอบสถานะ Server และการเชื่อมต่อฐานข้อมูล MySQL</div>
        </div>
        <a class="btn-test" href="/api/health" target="_blank">เปิดดู JSON ↗</a>
      </div>
    </div>

    <div class="section-title" style="margin-top: 28px;">🗂️ Core Delivery Endpoints</div>
    <div class="endpoint-list">
      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/customers</span>
          <div class="endpoint-desc">👥 รายชื่อลูกค้าทั้งหมด 30 จุด (มหาวิทยาลัยมหาสารคาม)</div>
        </div>
        <a class="btn-test" href="/api/customers" target="_blank">เปิดดู JSON ↗</a>
      </div>

      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/orders</span>
          <div class="endpoint-desc">📋 รายการออเดอร์กล่องข้าวทั้งหมด (25 รายการ)</div>
        </div>
        <a class="btn-test" href="/api/orders" target="_blank">เปิดดู JSON ↗</a>
      </div>

      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/riders</span>
          <div class="endpoint-desc">🛵 รายชื่อไรเดอร์ 15 คนพร้อมสีประจำตัว</div>
        </div>
        <a class="btn-test" href="/api/riders" target="_blank">เปิดดู JSON ↗</a>
      </div>

      <div class="endpoint-item">
        <div>
          <span class="method-get">GET</span>
          <span class="endpoint-path">/api/routes/plan</span>
          <div class="endpoint-desc">🗺️ แผนการจัดเส้นทาง VRP และค่าจัดส่ง (Delivery Jobs & Routes)</div>
        </div>
        <a class="btn-test" href="/api/routes/plan" target="_blank">เปิดดู JSON ↗</a>
      </div>
    </div>

    <footer>
      Deployment: Render Web Service | Database: Aiven Cloud MySQL | Architecture: Node.js Express + TypeScript
    </footer>
  </div>
</body>
</html>`;

  res.send(html);
});

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'Smart Lunchbox Delivery Routing System (MSU Area)',
    database: 'MySQL (Aiven Cloud / Local)',
    time: new Date().toISOString(),
    departureTime: CONFIG.BUSINESS.DEPARTURE_TIME,
    deadlineTime: CONFIG.BUSINESS.DEADLINE_TIME
  });
});

// Mount Routers (ตามสไตล์อาจารย์)
app.use('/api/customers', customerRouter);
app.use('/api/orders', orderRouter);
app.use('/api', routeRouter);

export default app;
export { app };

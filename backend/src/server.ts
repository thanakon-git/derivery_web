import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { app } from './app';
import { CONFIG } from './config';
import { initDatabase } from './dbconnect';

const PORT = process.env.PORT || CONFIG.PORT || 3000;

async function startServer() {
  // 1. Initialize MySQL schema and seed data (Aiven / Local MySQL)
  await initDatabase();

  // 2. Start Express Server on PORT
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Smart Delivery Backend running on port ${PORT}`);
    console.log(`📍 Shop: ${CONFIG.SHOP.name}`);
    console.log(`⏰ Schedule: 11:30 (Depart) -> 12:30 (Max Deadline)`);
    console.log(`💾 Architecture: Express Router + MySQL Pool`);
    console.log(`====================================================`);
  });
}

startServer();

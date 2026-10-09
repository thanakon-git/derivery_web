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

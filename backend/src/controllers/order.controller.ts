import { Router, Request, Response } from 'express';
import { pool } from '../dbconnect';
import { db } from '../database/db'; // Fallback cache
import { CONFIG } from '../config';

export const orderRouter = Router();

/**
 * GET /api/orders/nearby?lat=16.2452&lng=103.2501&radius=2
 * HW-5 Requirement: Search orders within specified radius (km) using Haversine formula
 */
orderRouter.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : CONFIG.SHOP.lat;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : CONFIG.SHOP.lng;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 2.0; // default 2 km

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      return res.status(400).json({ success: false, message: 'Invalid lat, lng, or radius query params' });
    }

    const query = `
      SELECT o.id, o.order_number AS orderNumber, o.customer_id AS customerId,
             c.name AS customerName, c.phone AS customerPhone, c.address,
             c.lat, c.lng, o.box_count AS boxCount, o.price_per_box AS pricePerBox,
             o.cost_per_box AS costPerBox, o.status, o.created_at AS createdAt,
             (6371 * ACOS(
               LEAST(1.0, GREATEST(-1.0,
                 COS(RADIANS(?)) * COS(RADIANS(c.lat)) * COS(RADIANS(c.lng) - RADIANS(?)) +
                 SIN(RADIANS(?)) * SIN(RADIANS(c.lat))
               ))
             )) AS distance_km
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      HAVING distance_km <= ?
      ORDER BY distance_km ASC;
    `;

    try {
      const [rows]: any = await pool.query(query, [lat, lng, lat, radius]);
      return res.json({
        success: true,
        count: rows.length,
        center: { lat, lng },
        radius_km: radius,
        data: rows
      });
    } catch (dbErr) {
      const orders = db.getOrders();
      const filtered = orders.map(o => {
        const dLat = ((o.lat - lat) * Math.PI) / 180;
        const dLon = ((o.lng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((o.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const dist = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        return { ...o, distance_km: Math.round(dist * 100) / 100 };
      }).filter(o => o.distance_km <= radius).sort((a, b) => a.distance_km - b.distance_km);

      return res.json({
        success: true,
        count: filtered.length,
        center: { lat, lng },
        radius_km: radius,
        data: filtered
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/orders
 * Get all current orders
 */
orderRouter.get('/', async (req: Request, res: Response) => {
  try {
    try {
      const query = `
        SELECT o.id, o.order_number AS orderNumber, o.customer_id AS customerId,
               c.name AS customerName, c.phone AS customerPhone, c.address,
               c.lat, c.lng, o.box_count AS boxCount, o.price_per_box AS pricePerBox,
               o.cost_per_box AS costPerBox, o.status, o.created_at AS createdAt
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at ASC
      `;
      const [rows]: any = await pool.query(query);
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (dbErr) {
      const orders = db.getOrders();
      return res.json({ success: true, count: orders.length, data: orders });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/orders
 * Create a new order
 */
orderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { customerId, boxCount } = req.body;
    if (!customerId || !boxCount) {
      return res.status(400).json({ success: false, message: 'Missing customerId or boxCount' });
    }

    const count = Math.min(Math.max(Number(boxCount), 1), 3);

    try {
      // Find customer
      const [custRows]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (custRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      const customer = custRows[0];

      const [orderCountRow]: any = await pool.query('SELECT COUNT(*) as count FROM orders');
      const orderNumber = `ORD-${(orderCountRow[0].count + 1).toString().padStart(3, '0')}`;
      const id = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await pool.query(
        'INSERT INTO orders (id, order_number, customer_id, box_count, price_per_box, cost_per_box, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, orderNumber, customerId, count, CONFIG.BUSINESS.PRICE_PER_BOX, CONFIG.BUSINESS.FOOD_COST_PER_BOX, 'PENDING']
      );

      const newOrder = {
        id,
        orderNumber,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        address: customer.address,
        lat: customer.lat,
        lng: customer.lng,
        boxCount: count,
        pricePerBox: CONFIG.BUSINESS.PRICE_PER_BOX,
        costPerBox: CONFIG.BUSINESS.FOOD_COST_PER_BOX,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      return res.status(201).json({ success: true, data: newOrder });
    } catch (dbErr) {
      const order = db.addOrder({ customerId, boxCount: count });
      return res.status(201).json({ success: true, data: order });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/orders/:id
 * Update an order
 */
orderRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { boxCount, status } = req.body;

    try {
      await pool.query(
        'UPDATE orders SET box_count = COALESCE(?, box_count), status = COALESCE(?, status) WHERE id = ?',
        [boxCount ? Number(boxCount) : null, status || null, id]
      );
      const [rows]: any = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, data: rows[0] });
    } catch (dbErr) {
      const order = db.updateOrder(id, req.body);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, data: order });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/orders/:id
 * Delete an order
 */
orderRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    try {
      const [result]: any = await pool.query('DELETE FROM orders WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, message: 'Order deleted successfully' });
    } catch (dbErr) {
      const deleted = db.deleteOrder(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, message: 'Order deleted successfully' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/orders/simulate
 * Simulate lunch rush (20-30 orders around 10:00 AM)
 */
orderRouter.post('/simulate', async (req: Request, res: Response) => {
  try {
    const count = req.body.count ? Number(req.body.count) : 25;

    try {
      // Clear old orders first
      await pool.query('DELETE FROM orders');

      // Fetch customers
      const [custRows]: any = await pool.query('SELECT * FROM customers');
      const shuffled = [...custRows].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(count, shuffled.length));

      const createdOrders = [];
      for (let i = 0; i < selected.length; i++) {
        const cust = selected[i];
        const boxCount = Math.floor(Math.random() * 3) + 1;
        const orderNumber = `ORD-${(i + 1).toString().padStart(3, '0')}`;
        const id = `ord-${i + 1}`;

        await pool.query(
          'INSERT INTO orders (id, order_number, customer_id, box_count, price_per_box, cost_per_box, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, orderNumber, cust.id, boxCount, CONFIG.BUSINESS.PRICE_PER_BOX, CONFIG.BUSINESS.FOOD_COST_PER_BOX, 'PENDING']
        );

        // Also sync to friend's `Order` table
        try {
          const custIntId = parseInt(cust.id.replace(/\D/g, ''), 10) || (i + 1);
          await pool.query('INSERT INTO `Order` (`Order_ID`, `Customer_ID`, `Quantity`) VALUES (?, ?, ?)', [i + 1, custIntId, boxCount]);
        } catch (syncErr) {
          // ignore if table doesn't exist
        }

        createdOrders.push({
          id,
          orderNumber,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          address: cust.address,
          lat: cust.lat,
          lng: cust.lng,
          boxCount,
          pricePerBox: CONFIG.BUSINESS.PRICE_PER_BOX,
          costPerBox: CONFIG.BUSINESS.FOOD_COST_PER_BOX,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });
      }

      // Also sync to memory cache for fast VRP access
      db.simulateRushOrders(count);

      return res.json({
        success: true,
        message: `Simulated ${createdOrders.length} lunch rush orders (10:00 AM rush)`,
        data: createdOrders
      });
    } catch (dbErr) {
      const orders = db.simulateRushOrders(count);
      return res.json({
        success: true,
        message: `Simulated ${orders.length} lunch rush orders (10:00 AM rush)`,
        data: orders
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/orders/clear
 * Clear all orders
 */
orderRouter.post('/clear', async (req: Request, res: Response) => {
  try {
    try {
      await pool.query('DELETE FROM orders');
    } catch (dbErr) {
      // ignore
    }
    db.clearOrders();
    return res.json({ success: true, message: 'Orders cleared successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

import { Router, Request, Response } from 'express';
import { pool } from '../dbconnect';
import { Customer } from '../types';
import { db } from '../database/db'; // Fallback cache if DB is offline

export const customerRouter = Router();

/**
 * GET /api/customers/nearby?lat=16.2452&lng=103.2501&radius=1
 * HW-5 Requirement: Search customers within specified radius (km) using Haversine formula
 */
customerRouter.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 16.2452;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 103.2501;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 1.0; // default 1 km

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      return res.status(400).json({ success: false, message: 'Invalid lat, lng, or radius query params' });
    }

    // Haversine query on MySQL
    const query = `
      SELECT id, name, phone, address, lat, lng, created_at,
        (6371 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            COS(RADIANS(?)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(lat))
          ))
        )) AS distance_km
      FROM customers
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
      // Fallback in-memory Haversine calculation if MySQL is not connected
      const customers = db.getCustomers();
      const filtered = customers.map(c => {
        const dLat = ((c.lat - lat) * Math.PI) / 180;
        const dLon = ((c.lng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const dist = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        return { ...c, distance_km: Math.round(dist * 100) / 100 };
      }).filter(c => c.distance_km <= radius).sort((a, b) => a.distance_km - b.distance_km);

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
 * GET /api/customers
 * Get all customers
 */
customerRouter.get('/', async (req: Request, res: Response) => {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM customers ORDER BY id ASC');
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (dbErr) {
      const customers = db.getCustomers();
      return res.json({ success: true, count: customers.length, data: customers });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/customers/:id
 * Get single customer by ID
 */
customerRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, data: rows[0] });
    } catch (dbErr) {
      const customer = db.getCustomerById(id);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, data: customer });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/customers
 * Create a new customer
 */
customerRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, phone, address, lat, lng } = req.body;
    if (!name || !phone || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
      const [countRow]: any = await pool.query('SELECT COUNT(*) as count FROM customers');
      const id = `CUST-${(countRow[0].count + 1).toString().padStart(2, '0')}`;
      
      await pool.query(
        'INSERT INTO customers (id, name, phone, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, phone, address, Number(lat), Number(lng)]
      );

      const [newCust]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
      return res.status(201).json({ success: true, data: newCust[0] });
    } catch (dbErr) {
      const customer = db.addCustomer({ name, phone, address, lat: Number(lat), lng: Number(lng) });
      return res.status(201).json({ success: true, data: customer });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/customers/:id
 * Update an existing customer
 */
customerRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, address, lat, lng } = req.body;

    try {
      await pool.query(
        'UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng) WHERE id = ?',
        [name, phone, address, lat !== undefined ? Number(lat) : null, lng !== undefined ? Number(lng) : null, id]
      );
      const [rows]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, data: rows[0] });
    } catch (dbErr) {
      const customer = db.updateCustomer(id, req.body);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, data: customer });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
customerRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    try {
      const [result]: any = await pool.query('DELETE FROM customers WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (dbErr) {
      const deleted = db.deleteCustomer(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({ success: true, message: 'Customer deleted successfully' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

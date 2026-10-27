import { Router, Request, Response } from 'express';
import { pool } from '../dbconnect';
import { db } from '../database/db';
import { VRPSolver } from '../services/vrp-solver';
import { CONFIG } from '../config';
import { DeliveryPlan, Order, Rider } from '../types';

export const routeRouter = Router();

/**
 * GET /api/shop
 * Get restaurant location and shop metadata
 */
routeRouter.get('/shop', (req: Request, res: Response) => {
  res.json({ success: true, data: CONFIG.SHOP });
});

/**
 * GET /api/riders
 * Get all available riders
 */
routeRouter.get('/riders', async (req: Request, res: Response) => {
  try {
    try {
      const [rows]: any = await pool.query('SELECT id, rider_number AS riderNumber, name, phone, color FROM riders ORDER BY rider_number ASC');
      return res.json({ success: true, data: rows });
    } catch (dbErr) {
      return res.json({ success: true, data: db.getRiders() });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/routes/plan
 * Get the current active delivery plan
 */
routeRouter.get('/routes/plan', async (req: Request, res: Response) => {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM delivery_plans ORDER BY created_at DESC LIMIT 1');
      if (rows.length > 0) {
        const plan: DeliveryPlan = JSON.parse(rows[0].plan_json);
        return res.json({ success: true, data: plan });
      }
    } catch (dbErr) {
      // fallback
    }
    const plan = db.getCurrentPlan();
    return res.json({ success: true, data: plan });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/routes/optimize
 * Optimize routes using VRP Solver and save result to MySQL
 */
routeRouter.post('/routes/optimize', async (req: Request, res: Response) => {
  try {
    const strategy = req.body.strategy || 'SMART_CLUSTER';
    let orders: Order[] = [];
    let riders: Rider[] = [];

    // 1. Fetch Orders and Riders
    try {
      const [orderRows]: any = await pool.query(`
        SELECT o.id, o.order_number AS orderNumber, o.customer_id AS customerId,
               c.name AS customerName, c.phone AS customerPhone, c.address,
               c.lat, c.lng, o.box_count AS boxCount, o.price_per_box AS pricePerBox,
               o.cost_per_box AS costPerBox, o.status, o.created_at AS createdAt
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at ASC
      `);
      orders = orderRows;

      const [riderRows]: any = await pool.query('SELECT id, rider_number AS riderNumber, name, phone, color FROM riders ORDER BY rider_number ASC');
      riders = riderRows;
    } catch (dbErr) {
      orders = db.getOrders();
      riders = db.getRiders();
    }

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No orders available to optimize. Please create or simulate orders first.'
      });
    }

    // 2. Solve VRP with strict constraints (<= 3 orders/rider, <= 60 mins)
    const plan = VRPSolver.optimizeDeliveryRoutes(orders, riders, strategy);

    // 3. Save Delivery Plan into MySQL
    try {
      await pool.query(`
        INSERT INTO delivery_plans (
          id, departure_time, deadline_time, optimization_strategy,
          total_orders, total_boxes, total_riders_used, total_distance_km,
          max_trip_duration_minutes, is_all_within_deadline, total_revenue,
          total_food_cost, total_rider_cost, net_profit, profit_margin_percent,
          plan_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        plan.id, plan.departureTime, plan.deadlineTime, plan.optimizationStrategy,
        plan.totalOrders, plan.totalBoxes, plan.totalRidersUsed, plan.totalDistanceKm,
        plan.maxTripDurationMinutes, plan.isAllWithinDeadline, plan.totalRevenue,
        plan.totalFoodCost, plan.totalRiderCost, plan.netProfit, plan.profitMarginPercent,
        JSON.stringify(plan)
      ]);

      // 4. Save normalized Delivery_Jobs and Delivery_Routes (Friend 2 ERDPlus Model)
      for (const r of plan.routes) {
        const jobId = `${plan.id}-${r.jobCode}`;
        await pool.query(`
          INSERT INTO delivery_jobs (
            id, job_code, rider_id, plan_id, total_boxes, total_distance,
            delivery_cost, departure_time, completion_time, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE total_boxes=VALUES(total_boxes), total_distance=VALUES(total_distance)
        `, [
          jobId, r.jobCode, r.riderId, plan.id, r.totalBoxes, r.totalDistanceKm,
          r.riderTotalCost, r.departureTime, r.estimatedCompletionTime, 'ASSIGNED'
        ]);

        for (const stop of r.stops) {
          const routeId = `${jobId}-STOP-${stop.stopNumber}`;
          await pool.query(`
            INSERT INTO delivery_routes (
              id, job_id, order_id, sequence_number, distance_from_prev,
              estimated_arrival_minutes, google_maps_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE sequence_number=VALUES(sequence_number)
          `, [
            routeId, jobId, stop.orderId, stop.stopNumber, stop.distanceFromPrevKm,
            stop.estimatedArrivalMinutesFromStart, stop.googleMapsUrl
          ]);
        }

        // Also sync to friend's `Delivery_Job` and `Delivery_Route`
        try {
          const riderIntId = parseInt(r.riderId.replace(/\D/g, ''), 10) || r.riderNumber || 1;
          const [jobRes]: any = await pool.query(`
            INSERT INTO \`Delivery_Job\` (\`Job_Code\`, \`Rider_ID\`, \`Total_Distance\`, \`Delivery_Cost\`)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE \`Total_Distance\`=VALUES(\`Total_Distance\`), \`Delivery_Cost\`=VALUES(\`Delivery_Cost\`)
          `, [r.jobCode, riderIntId, r.totalDistanceKm, r.riderTotalCost]);

          const insertedJobId = jobRes.insertId;
          if (insertedJobId) {
            for (const stop of r.stops) {
              const orderIntId = parseInt(stop.orderId.replace(/\D/g, ''), 10) || 1;
              try {
                await pool.query(`
                  INSERT INTO \`Delivery_Route\` (\`Job_ID\`, \`Order_ID\`, \`Sequence_Number\`)
                  VALUES (?, ?, ?)
                `, [insertedJobId, orderIntId, stop.stopNumber]);
              } catch {}
            }
          }
        } catch (fErr) {
          // ignore if tables not present
        }
      }

      // 5. Update orders status to ASSIGNED in MySQL
      const assignedIds = new Set<string>();
      plan.routes.forEach(r => r.orders.forEach(o => assignedIds.add(o.id)));
      if (assignedIds.size > 0) {
        const idList = Array.from(assignedIds);
        const placeholders = idList.map(() => '?').join(',');
        await pool.query(`UPDATE orders SET status = 'ASSIGNED' WHERE id IN (${placeholders})`, idList);
      }
    } catch (dbErr: any) {
      console.warn('⚠️ [MySQL] Note on saving plan details:', dbErr.message);
    }

    db.saveDeliveryPlan(plan);

    return res.json({
      success: true,
      message: `Routes calculated successfully for ${orders.length} orders across ${plan.totalRidersUsed} riders.`,
      data: plan
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/rider/job/:jobCode
 * Rider views their assigned job by jobCode (e.g. "JOB-01" or riderNumber)
 */
routeRouter.get('/rider/job/:jobCode', async (req: Request, res: Response) => {
  try {
    const { jobCode } = req.params;
    let plan: DeliveryPlan | null = null;

    try {
      const [rows]: any = await pool.query('SELECT * FROM delivery_plans ORDER BY created_at DESC LIMIT 1');
      if (rows.length > 0) {
        plan = JSON.parse(rows[0].plan_json);
      }
    } catch (dbErr) {
      // fallback
    }

    if (!plan) {
      plan = db.getCurrentPlan();
    }

    if (!plan || !plan.routes || plan.routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ยังไม่มีใบงานที่จัดส่งในระบบ กรุณารอทางร้านจัดเส้นทางส่งรอบ 11:30 น.'
      });
    }

    const route = plan.routes.find(
      r =>
        r.jobCode.toUpperCase() === jobCode.toUpperCase() ||
        r.riderId.toUpperCase() === jobCode.toUpperCase() ||
        `RIDER-${r.riderNumber}`.toUpperCase() === jobCode.toUpperCase() ||
        `${r.riderNumber}` === jobCode
    );

    if (!route) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบใบงานรหัส "${jobCode}" กรุณาตรวจสอบรหัสใบงานอีกครั้ง (เช่น JOB-01, JOB-02)`
      });
    }

    return res.json({
      success: true,
      data: {
        shop: CONFIG.SHOP,
        route
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/rider/job/:jobCode/status
 * Rider updates their delivery status
 */
routeRouter.post('/rider/job/:jobCode/status', async (req: Request, res: Response) => {
  try {
    const { jobCode } = req.params;
    const { status } = req.body; // 'DELIVERING' | 'DELIVERED'

    if (!['DELIVERING', 'DELIVERED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
      // Find latest plan to get order IDs for this job
      const [rows]: any = await pool.query('SELECT * FROM delivery_plans ORDER BY created_at DESC LIMIT 1');
      if (rows.length > 0) {
        const plan: DeliveryPlan = JSON.parse(rows[0].plan_json);
        const route = plan.routes.find(r => r.jobCode.toUpperCase() === jobCode.toUpperCase());
        if (route) {
          const orderIds = route.orders.map(o => o.id);
          const statusPlaceholders = orderIds.map(() => '?').join(',');
          if (orderIds.length > 0) {
            await pool.query(`UPDATE orders SET status = ? WHERE id IN (${statusPlaceholders})`, [status, ...orderIds]);
          }
        }
      }
    } catch (dbErr) {
      // ignore
    }

    db.updateJobStatus(jobCode, status);
    return res.json({ success: true, message: `Updated job ${jobCode} to ${status}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

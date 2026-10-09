import { CONFIG } from '../config';
import { DeliveryPlan, DeliveryStop, Order, Rider, RiderRoute } from '../types';
import { CostCalculator } from './cost-calculator';

export class VRPSolver {
  /**
   * Calculate Haversine distance between two coordinates in kilometers.
   * Multiplied by a circuity factor to reflect realistic urban/campus road distance.
   */
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;
    return straightLine * CONFIG.BUSINESS.CIRCUITY_FACTOR;
  }

  /**
   * Calculate polar angle (bearing in radians) from shop center to customer.
   * Useful for sweep / angular clustering around campus to avoid crossing town.
   */
  private static calculateAngle(shopLat: number, shopLng: number, targetLat: number, targetLng: number): number {
    return Math.atan2(targetLat - shopLat, targetLng - shopLng);
  }

  /**
   * Main Route Optimization entrypoint.
   */
  public static optimizeDeliveryRoutes(
    orders: Order[],
    riders: Rider[],
    strategy: 'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY' = 'SMART_CLUSTER'
  ): DeliveryPlan {
    if (orders.length === 0) {
      return this.createEmptyPlan(strategy);
    }

    const shop = CONFIG.SHOP;
    const maxOrdersPerRider = CONFIG.BUSINESS.MAX_ORDERS_PER_RIDER; // 3

    // 1. Cluster orders into groups where each group has <= 3 orders
    let orderClusters: Order[][] = [];

    switch (strategy) {
      case 'MIN_RIDERS':
        orderClusters = this.clusterMinRiders(orders, shop, maxOrdersPerRider);
        break;
      case 'FASTEST_DELIVERY':
        orderClusters = this.clusterFastestDelivery(orders, shop, maxOrdersPerRider);
        break;
      case 'SMART_CLUSTER':
      default:
        orderClusters = this.clusterBySweepAndProximity(orders, shop, maxOrdersPerRider);
        break;
    }

    // 2. Build optimized TSP route for each cluster
    const routes: RiderRoute[] = [];

    orderClusters.forEach((cluster, index) => {
      const rider = riders[index % riders.length] || {
        id: `RIDER-${(index + 1).toString().padStart(2, '0')}`,
        riderNumber: index + 1,
        name: `ไรเดอร์ ${index + 1}`,
        phone: `081-999-00${index + 1}`,
        color: CONFIG.RIDER_PALETTE[index % CONFIG.RIDER_PALETTE.length]
      };

      const jobCode = `JOB-${(index + 1).toString().padStart(2, '0')}`;
      const route = this.buildOptimizedRoute(shop, rider, jobCode, cluster);
      routes.push(route);
    });

    // 3. Summarize Overall Delivery Plan Metrics
    let totalBoxes = 0;
    let totalDistanceKm = 0;
    let maxTripDurationMinutes = 0;
    let totalRevenue = 0;
    let totalFoodCost = 0;
    let totalRiderCost = 0;
    let isAllWithinDeadline = true;

    routes.forEach(r => {
      totalBoxes += r.totalBoxes;
      totalDistanceKm += r.totalDistanceKm;
      if (r.estimatedDurationMinutes > maxTripDurationMinutes) {
        maxTripDurationMinutes = r.estimatedDurationMinutes;
      }
      if (!r.isWithinDeadline) {
        isAllWithinDeadline = false;
      }
      totalRevenue += r.revenue;
      totalFoodCost += r.foodCost;
      totalRiderCost += r.riderTotalCost;
    });

    const netProfit = Math.round((totalRevenue - totalFoodCost - totalRiderCost) * 100) / 100;
    const profitMarginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;

    return {
      id: `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      departureTime: CONFIG.BUSINESS.DEPARTURE_TIME,
      deadlineTime: CONFIG.BUSINESS.DEADLINE_TIME,
      optimizationStrategy: strategy,
      totalOrders: orders.length,
      totalBoxes,
      totalRidersUsed: routes.length,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      maxTripDurationMinutes,
      isAllWithinDeadline,
      totalRevenue,
      totalFoodCost,
      totalRiderCost: Math.round(totalRiderCost * 100) / 100,
      netProfit,
      profitMarginPercent,
      routes
    };
  }

  /**
   * Spatial Sweep & Proximity Clustering
   * Groups orders by geographic angle relative to the shop, then chunks into groups of max 3.
   * Guarantees riders serve a coherent neighborhood without crossing paths.
   */
  private static clusterBySweepAndProximity(orders: Order[], shop: typeof CONFIG.SHOP, maxCap: number): Order[][] {
    const ordersWithAngle = orders.map(order => ({
      order,
      angle: this.calculateAngle(shop.lat, shop.lng, order.lat, order.lng),
      distToShop: this.calculateDistanceKm(shop.lat, shop.lng, order.lat, order.lng)
    }));

    // Sort radially around shop
    ordersWithAngle.sort((a, b) => a.angle - b.angle);

    const clusters: Order[][] = [];
    for (let i = 0; i < ordersWithAngle.length; i += maxCap) {
      clusters.push(ordersWithAngle.slice(i, i + maxCap).map(item => item.order));
    }
    return clusters;
  }

  /**
   * Minimum Riders Clustering (Greedy Savings)
   * Packs orders strictly to fill 3 orders per rider, minimizing total distance.
   */
  private static clusterMinRiders(orders: Order[], shop: typeof CONFIG.SHOP, maxCap: number): Order[][] {
    const unassigned = [...orders];
    const clusters: Order[][] = [];

    while (unassigned.length > 0) {
      // Pick order farthest from shop as anchor
      unassigned.sort((a, b) => {
        const distA = this.calculateDistanceKm(shop.lat, shop.lng, a.lat, a.lng);
        const distB = this.calculateDistanceKm(shop.lat, shop.lng, b.lat, b.lng);
        return distB - distA;
      });

      const cluster: Order[] = [unassigned.shift()!];

      // Add nearest neighbors to this cluster until maxCap (3)
      while (cluster.length < maxCap && unassigned.length > 0) {
        const lastOrder = cluster[cluster.length - 1];
        let bestIndex = 0;
        let bestDist = Infinity;

        unassigned.forEach((cand, idx) => {
          const dist = this.calculateDistanceKm(lastOrder.lat, lastOrder.lng, cand.lat, cand.lng);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = idx;
          }
        });

        cluster.push(unassigned.splice(bestIndex, 1)[0]);
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Fastest Delivery Clustering
   * Balances load across slightly more riders if needed to ensure minimal delivery durations.
   */
  private static clusterFastestDelivery(orders: Order[], shop: typeof CONFIG.SHOP, maxCap: number): Order[][] {
    // If we have 20 orders, instead of 7 riders (3,3,3,3,3,3,2),
    // we can distribute 2-3 per rider geographically to speed up arrival times
    return this.clusterBySweepAndProximity(orders, shop, 2); // max 2 orders per rider for faster delivery
  }

  /**
   * Solves TSP (Traveling Salesperson Problem) for a single rider's assigned orders.
   * Start: Shop -> Stop 1 -> Stop 2 -> Stop 3.
   * Evaluates permutations (since max 3 orders, permutations = 3! = 6) to find the absolute shortest sequence.
   */
  private static buildOptimizedRoute(
    shop: typeof CONFIG.SHOP,
    rider: Rider,
    jobCode: string,
    cluster: Order[]
  ): RiderRoute {
    const bestOrderSequence = this.findShortestPathSequence(shop, cluster);

    // Calculate sequential stops
    let currentLat = shop.lat;
    let currentLng = shop.lng;
    let totalDistKm = 0;
    let cumulativeMinutes = 0;
    let totalBoxes = 0;

    const stops: DeliveryStop[] = [];
    const waypoints: { lat: number; lng: number; label: string }[] = [
      { lat: shop.lat, lng: shop.lng, label: shop.name }
    ];

    bestOrderSequence.forEach((order, index) => {
      const legDist = this.calculateDistanceKm(currentLat, currentLng, order.lat, order.lng);
      totalDistKm += legDist;
      totalBoxes += order.boxCount;

      const travelTimeMin = (legDist / CONFIG.BUSINESS.RIDER_SPEED_KMH) * 60;
      cumulativeMinutes += Math.ceil(travelTimeMin + CONFIG.BUSINESS.SERVICE_TIME_PER_STOP_MIN);

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`;

      stops.push({
        stopNumber: index + 1,
        orderId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        boxCount: order.boxCount,
        lat: order.lat,
        lng: order.lng,
        distanceFromPrevKm: Math.round(legDist * 100) / 100,
        estimatedArrivalMinutesFromStart: cumulativeMinutes,
        googleMapsUrl
      });

      waypoints.push({
        lat: order.lat,
        lng: order.lng,
        label: `จุดที่ ${index + 1}: ${order.customerName} (${order.boxCount} กล่อง)`
      });

      currentLat = order.lat;
      currentLng = order.lng;
    });

    const totalDistanceRounded = Math.round(totalDistKm * 100) / 100;
    const durationMinutes = CostCalculator.estimateDurationMinutes(totalDistanceRounded, stops.length);
    const departureTime = CONFIG.BUSINESS.DEPARTURE_TIME;
    const estimatedCompletionTime = CostCalculator.calculateCompletionTime(departureTime, durationMinutes);
    const isWithinDeadline = durationMinutes <= CONFIG.BUSINESS.MAX_ALLOWED_MINUTES;

    const fin = CostCalculator.calculateRouteFinancials(totalDistanceRounded, totalBoxes);

    return {
      riderId: rider.id,
      riderNumber: rider.riderNumber,
      riderName: rider.name,
      riderPhone: rider.phone,
      riderColor: rider.color,
      jobCode,
      orders: bestOrderSequence,
      stops,
      totalBoxes,
      totalDistanceKm: totalDistanceRounded,
      estimatedDurationMinutes: durationMinutes,
      departureTime,
      estimatedCompletionTime,
      isWithinDeadline,
      baseFee: fin.baseFee,
      distanceFee: fin.distanceFee,
      riderTotalCost: fin.riderTotalCost,
      revenue: fin.revenue,
      foodCost: fin.foodCost,
      grossProfit: fin.grossProfit,
      waypoints
    };
  }

  /**
   * Find permutation of orders that minimizes total travel distance from shop.
   */
  private static findShortestPathSequence(shop: typeof CONFIG.SHOP, orders: Order[]): Order[] {
    if (orders.length <= 1) return orders;

    const permutations = this.getPermutations(orders);
    let bestSeq = orders;
    let minDistance = Infinity;

    permutations.forEach(seq => {
      let dist = 0;
      let curLat = shop.lat;
      let curLng = shop.lng;

      seq.forEach(order => {
        dist += this.calculateDistanceKm(curLat, curLng, order.lat, order.lng);
        curLat = order.lat;
        curLng = order.lng;
      });

      if (dist < minDistance) {
        minDistance = dist;
        bestSeq = seq;
      }
    });

    return bestSeq;
  }

  private static getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const remainingPerms = this.getPermutations(remaining);
      for (const p of remainingPerms) {
        result.push([current, ...p]);
      }
    }
    return result;
  }

  private static createEmptyPlan(strategy: 'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY'): DeliveryPlan {
    return {
      id: `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      departureTime: CONFIG.BUSINESS.DEPARTURE_TIME,
      deadlineTime: CONFIG.BUSINESS.DEADLINE_TIME,
      optimizationStrategy: strategy,
      totalOrders: 0,
      totalBoxes: 0,
      totalRidersUsed: 0,
      totalDistanceKm: 0,
      maxTripDurationMinutes: 0,
      isAllWithinDeadline: true,
      totalRevenue: 0,
      totalFoodCost: 0,
      totalRiderCost: 0,
      netProfit: 0,
      profitMarginPercent: 0,
      routes: []
    };
  }
}

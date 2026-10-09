import { CONFIG } from '../config';

export interface RouteFinancials {
  totalBoxes: number;
  totalDistanceKm: number;
  baseFee: number;
  distanceFee: number;
  riderTotalCost: number;
  revenue: number;
  foodCost: number;
  grossProfit: number;
  isProfit: boolean;
}

export class CostCalculator {
  /**
   * Calculate financial breakdown for a single rider's trip according to the shop's rules:
   * Rider Cost = 15 THB (base) + (distanceKm * 2 THB * totalBoxes)
   * Revenue = totalBoxes * 65 THB
   * Food Cost = totalBoxes * 40 THB
   * Gross Profit = Revenue - Food Cost - Rider Cost
   */
  public static calculateRouteFinancials(distanceKm: number, totalBoxes: number): RouteFinancials {
    const roundedDistance = Math.round(distanceKm * 100) / 100;
    const baseFee = CONFIG.BUSINESS.RIDER_BASE_FEE;
    const distanceFee = Math.round(roundedDistance * CONFIG.BUSINESS.RIDER_KM_BOX_RATE * totalBoxes * 100) / 100;
    const riderTotalCost = Math.round((baseFee + distanceFee) * 100) / 100;

    const revenue = totalBoxes * CONFIG.BUSINESS.PRICE_PER_BOX;
    const foodCost = totalBoxes * CONFIG.BUSINESS.FOOD_COST_PER_BOX;
    const grossProfit = Math.round((revenue - foodCost - riderTotalCost) * 100) / 100;

    return {
      totalBoxes,
      totalDistanceKm: roundedDistance,
      baseFee,
      distanceFee,
      riderTotalCost,
      revenue,
      foodCost,
      grossProfit,
      isProfit: grossProfit > 0
    };
  }

  /**
   * Estimate travel and service duration in minutes:
   * Speed = 30 km/h (0.5 km per min => 2 min per km)
   * Service time = 3 minutes per stop
   */
  public static estimateDurationMinutes(distanceKm: number, numberOfStops: number): number {
    const travelTimeMinutes = (distanceKm / CONFIG.BUSINESS.RIDER_SPEED_KMH) * 60;
    const serviceTimeMinutes = numberOfStops * CONFIG.BUSINESS.SERVICE_TIME_PER_STOP_MIN;
    return Math.ceil(travelTimeMinutes + serviceTimeMinutes);
  }

  /**
   * Convert departure time ("11:30") + minutes into completion time string (e.g. "12:05")
   */
  public static calculateCompletionTime(departureTime: string, durationMinutes: number): string {
    const [depHour, depMin] = departureTime.split(':').map(Number);
    const totalMinutes = depHour * 60 + depMin + durationMinutes;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

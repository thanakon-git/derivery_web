export interface Shop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'DELIVERING' | 'DELIVERED';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  lat: number;
  lng: number;
  boxCount: number; // 1 to 3 boxes
  pricePerBox: number; // 65 THB
  costPerBox: number; // 40 THB
  status: OrderStatus;
  createdAt: string;
}

export interface Rider {
  id: string;
  riderNumber: number;
  name: string;
  phone: string;
  color: string;
}

export interface DeliveryStop {
  stopNumber: number;
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  boxCount: number;
  lat: number;
  lng: number;
  distanceFromPrevKm: number;
  estimatedArrivalMinutesFromStart: number;
  googleMapsUrl: string;
}

export interface RiderRoute {
  riderId: string;
  riderNumber: number;
  riderName: string;
  riderPhone: string;
  riderColor: string;
  jobCode: string; // e.g. "JOB-01"
  orders: Order[];
  stops: DeliveryStop[];
  totalBoxes: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  departureTime: string; // e.g. "11:30"
  estimatedCompletionTime: string; // e.g. "12:05"
  isWithinDeadline: boolean; // <= 60 minutes
  baseFee: number; // 15 THB
  distanceFee: number; // distanceKm * 2 * totalBoxes
  riderTotalCost: number; // baseFee + distanceFee
  revenue: number; // totalBoxes * 65
  foodCost: number; // totalBoxes * 40
  grossProfit: number; // revenue - foodCost - riderTotalCost
  waypoints: { lat: number; lng: number; label: string }[];
}

export interface DeliveryPlan {
  id: string;
  createdAt: string;
  departureTime: string; // 11:30
  deadlineTime: string; // 12:30
  optimizationStrategy: 'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY';
  totalOrders: number;
  totalBoxes: number;
  totalRidersUsed: number;
  totalDistanceKm: number;
  maxTripDurationMinutes: number;
  isAllWithinDeadline: boolean;
  totalRevenue: number;
  totalFoodCost: number;
  totalRiderCost: number;
  netProfit: number;
  profitMarginPercent: number;
  routes: RiderRoute[];
}

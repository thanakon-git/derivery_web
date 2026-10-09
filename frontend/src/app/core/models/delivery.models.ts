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
  boxCount: number;
  pricePerBox: number;
  costPerBox: number;
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
  jobCode: string;
  orders: Order[];
  stops: DeliveryStop[];
  totalBoxes: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  departureTime: string;
  estimatedCompletionTime: string;
  isWithinDeadline: boolean;
  baseFee: number;
  distanceFee: number;
  riderTotalCost: number;
  revenue: number;
  foodCost: number;
  grossProfit: number;
  waypoints: { lat: number; lng: number; label: string }[];
}

export interface DeliveryPlan {
  id: string;
  createdAt: string;
  departureTime: string;
  deadlineTime: string;
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

export interface RiderJobResponse {
  shop: Shop;
  route: RiderRoute;
}

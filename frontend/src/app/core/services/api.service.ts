import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  Customer,
  DeliveryPlan,
  Order,
  Rider,
  RiderJobResponse,
  Shop
} from '../models/delivery.models';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api';

  // --- Shop & Riders ---
  getShopInfo(): Observable<Shop> {
    return this.http.get<ApiResponse<Shop>>(`${this.baseUrl}/shop`).pipe(
      map(res => res.data)
    );
  }

  getRiders(): Observable<Rider[]> {
    return this.http.get<ApiResponse<Rider[]>>(`${this.baseUrl}/riders`).pipe(
      map(res => res.data)
    );
  }

  // --- Customers ---
  getCustomers(): Observable<Customer[]> {
    return this.http.get<ApiResponse<Customer[]>>(`${this.baseUrl}/customers`).pipe(
      map(res => res.data)
    );
  }

  addCustomer(customer: Omit<Customer, 'id'>): Observable<Customer> {
    return this.http.post<ApiResponse<Customer>>(`${this.baseUrl}/customers`, customer).pipe(
      map(res => res.data)
    );
  }

  updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
    return this.http.put<ApiResponse<Customer>>(`${this.baseUrl}/customers/${id}`, customer).pipe(
      map(res => res.data)
    );
  }

  deleteCustomer(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/customers/${id}`).pipe(
      map(res => res.success)
    );
  }

  // --- Orders ---
  getOrders(): Observable<Order[]> {
    return this.http.get<ApiResponse<Order[]>>(`${this.baseUrl}/orders`).pipe(
      map(res => res.data)
    );
  }

  addOrder(customerId: string, boxCount: number): Observable<Order> {
    return this.http.post<ApiResponse<Order>>(`${this.baseUrl}/orders`, { customerId, boxCount }).pipe(
      map(res => res.data)
    );
  }

  deleteOrder(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/orders/${id}`).pipe(
      map(res => res.success)
    );
  }

  simulateOrders(count: number = 25): Observable<Order[]> {
    return this.http.post<ApiResponse<Order[]>>(`${this.baseUrl}/orders/simulate`, { count }).pipe(
      map(res => res.data)
    );
  }

  clearOrders(): Observable<boolean> {
    return this.http.post<ApiResponse<null>>(`${this.baseUrl}/orders/clear`, {}).pipe(
      map(res => res.success)
    );
  }

  // --- Route Optimization ---
  getCurrentPlan(): Observable<DeliveryPlan | null> {
    return this.http.get<ApiResponse<DeliveryPlan | null>>(`${this.baseUrl}/routes/plan`).pipe(
      map(res => res.data)
    );
  }

  optimizeRoutes(strategy: 'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY' = 'SMART_CLUSTER'): Observable<DeliveryPlan> {
    return this.http.post<ApiResponse<DeliveryPlan>>(`${this.baseUrl}/routes/optimize`, { strategy }).pipe(
      map(res => res.data)
    );
  }

  // --- Rider Mobile ---
  getRiderJob(jobCode: string): Observable<RiderJobResponse> {
    return this.http.get<ApiResponse<RiderJobResponse>>(`${this.baseUrl}/rider/job/${jobCode}`).pipe(
      map(res => res.data)
    );
  }

  updateJobStatus(jobCode: string, status: 'DELIVERING' | 'DELIVERED'): Observable<boolean> {
    return this.http.post<ApiResponse<null>>(`${this.baseUrl}/rider/job/${jobCode}/status`, { status }).pipe(
      map(res => res.success)
    );
  }
}

import fs from 'fs';
import path from 'path';
import { Customer, Order, Rider, DeliveryPlan } from '../types';
import { INITIAL_CUSTOMERS } from './seed';
import { CONFIG } from '../config';

interface DatabaseSchema {
  customers: Customer[];
  orders: Order[];
  riders: Rider[];
  currentPlan: DeliveryPlan | null;
}

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseService {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirectoryExists();
    this.data = this.loadData();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading db.json, initializing fresh data:', err);
    }

    // Default Initial Data
    const initialRiders: Rider[] = Array.from({ length: 15 }, (_, i) => ({
      id: `RIDER-${(i + 1).toString().padStart(2, '0')}`,
      riderNumber: i + 1,
      name: `ไรเดอร์ ${i + 1}`,
      phone: `08${(i + 1).toString().padStart(2, '0')}-999-8888`,
      color: CONFIG.RIDER_PALETTE[i % CONFIG.RIDER_PALETTE.length]
    }));

    const initialData: DatabaseSchema = {
      customers: INITIAL_CUSTOMERS,
      orders: [],
      riders: initialRiders,
      currentPlan: null
    };

    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  // --- Customers ---
  public getCustomers(): Customer[] {
    return this.data.customers;
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.data.customers.find(c => c.id === id);
  }

  public addCustomer(cust: Omit<Customer, 'id'>): Customer {
    const id = `CUST-${(this.data.customers.length + 1).toString().padStart(2, '0')}`;
    const newCustomer: Customer = { id, ...cust };
    this.data.customers.push(newCustomer);
    this.saveData(this.data);
    return newCustomer;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const idx = this.data.customers.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.saveData(this.data);
    return this.data.customers[idx];
  }

  public deleteCustomer(id: string): boolean {
    const initialLen = this.data.customers.length;
    this.data.customers = this.data.customers.filter(c => c.id !== id);
    if (this.data.customers.length !== initialLen) {
      this.saveData(this.data);
      return true;
    }
    return false;
  }

  // --- Orders ---
  public getOrders(): Order[] {
    return this.data.orders;
  }

  public addOrder(orderData: { customerId: string; boxCount: number }): Order {
    const customer = this.getCustomerById(orderData.customerId);
    if (!customer) {
      throw new Error(`Customer with id ${orderData.customerId} not found`);
    }

    const orderNumber = `ORD-${(this.data.orders.length + 1).toString().padStart(3, '0')}`;
    const id = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newOrder: Order = {
      id,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      address: customer.address,
      lat: customer.lat,
      lng: customer.lng,
      boxCount: Math.min(Math.max(orderData.boxCount, 1), 3), // 1 to 3 boxes
      pricePerBox: CONFIG.BUSINESS.PRICE_PER_BOX,
      costPerBox: CONFIG.BUSINESS.FOOD_COST_PER_BOX,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    this.data.orders.push(newOrder);
    this.saveData(this.data);
    return newOrder;
  }

  public updateOrder(id: string, updates: Partial<Order>): Order | null {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    this.data.orders[idx] = { ...this.data.orders[idx], ...updates };
    this.saveData(this.data);
    return this.data.orders[idx];
  }

  public deleteOrder(id: string): boolean {
    const initialLen = this.data.orders.length;
    this.data.orders = this.data.orders.filter(o => o.id !== id);
    if (this.data.orders.length !== initialLen) {
      this.saveData(this.data);
      return true;
    }
    return false;
  }

  public clearOrders(): void {
    this.data.orders = [];
    this.data.currentPlan = null;
    this.saveData(this.data);
  }

  /**
   * Simulate a rush hour of 20 to 30 lunchbox orders (around 10:00 AM)
   * Each customer orders 1 to 3 lunchboxes as specified in the business requirements.
   */
  public simulateRushOrders(count = 25): Order[] {
    this.data.orders = [];
    const availableCustomers = [...this.data.customers];
    // Shuffle customers
    const shuffled = availableCustomers.sort(() => 0.5 - Math.random());
    const selectedCustomers = shuffled.slice(0, Math.min(count, shuffled.length));

    selectedCustomers.forEach((cust, index) => {
      // 1 to 3 boxes per order
      const boxCount = Math.floor(Math.random() * 3) + 1;
      const orderNumber = `ORD-${(index + 1).toString().padStart(3, '0')}`;
      this.data.orders.push({
        id: `ord-${index + 1}`,
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
    });

    this.data.currentPlan = null;
    this.saveData(this.data);
    return this.data.orders;
  }

  // --- Riders ---
  public getRiders(): Rider[] {
    return this.data.riders;
  }

  // --- Delivery Plan ---
  public getCurrentPlan(): DeliveryPlan | null {
    return this.data.currentPlan;
  }

  public saveDeliveryPlan(plan: DeliveryPlan): void {
    this.data.currentPlan = plan;
    // Mark orders as assigned
    const assignedIds = new Set<string>();
    plan.routes.forEach(r => r.orders.forEach(o => assignedIds.add(o.id)));
    this.data.orders.forEach(o => {
      if (assignedIds.has(o.id)) {
        o.status = 'ASSIGNED';
      }
    });
    this.saveData(this.data);
  }

  public updateJobStatus(jobCode: string, newStatus: 'DELIVERING' | 'DELIVERED'): boolean {
    if (!this.data.currentPlan) return false;
    const route = this.data.currentPlan.routes.find(r => r.jobCode.toUpperCase() === jobCode.toUpperCase());
    if (!route) return false;

    const orderIds = new Set(route.orders.map(o => o.id));
    this.data.orders.forEach(o => {
      if (orderIds.has(o.id)) {
        o.status = newStatus;
      }
    });
    this.saveData(this.data);
    return true;
  }
}

export const db = new DatabaseService();

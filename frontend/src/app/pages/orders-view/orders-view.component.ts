import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Customer, Order } from '../../core/models/delivery.models';

@Component({
  selector: 'app-orders-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './orders-view.component.html'
})
export class OrdersViewComponent implements OnInit {
  private api = inject(ApiService);

  public orders = signal<Order[]>([]);
  public customers = signal<Customer[]>([]);
  public isLoading = signal<boolean>(false);
  public isAdding = signal<boolean>(false);

  // New order form
  public selectedCustomerId = '';
  public newBoxCount = 1;

  ngOnInit() {
    this.loadData();
  }

  public loadData() {
    this.isLoading.set(true);
    this.api.getOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.api.getCustomers().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        if (customers.length > 0 && !this.selectedCustomerId) {
          this.selectedCustomerId = customers[0].id;
        }
      }
    });
  }

  public simulateOrders(count: number = 25) {
    this.isLoading.set(true);
    this.api.simulateOrders(count).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  public clearOrders() {
    if (confirm('คุณต้องการล้างรายการออเดอร์ทั้งหมดใช่หรือไม่?')) {
      this.isLoading.set(true);
      this.api.clearOrders().subscribe({
        next: () => {
          this.orders.set([]);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    }
  }

  public addOrder() {
    if (!this.selectedCustomerId) return;
    this.isLoading.set(true);
    this.api.addOrder(this.selectedCustomerId, this.newBoxCount).subscribe({
      next: () => {
        this.isAdding.set(false);
        this.loadData();
      },
      error: (err) => {
        alert('เกิดข้อผิดพลาด: ' + (err.error?.message || 'ไม่สามารถเพิ่มออเดอร์ได้'));
        this.isLoading.set(false);
      }
    });
  }

  public deleteOrder(id: string) {
    if (confirm('คุณต้องการลบออเดอร์นี้ใช่หรือไม่?')) {
      this.api.deleteOrder(id).subscribe({
        next: () => {
          this.orders.update(orders => orders.filter(o => o.id !== id));
        }
      });
    }
  }

  public getTotalBoxes(): number {
    return this.orders().reduce((sum, o) => sum + o.boxCount, 0);
  }

  public getTotalRevenue(): number {
    return this.getTotalBoxes() * 65;
  }
}

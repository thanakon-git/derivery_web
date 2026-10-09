import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { Customer, Shop } from '../../core/models/delivery.models';

@Component({
  selector: 'app-customers-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers-view.component.html',
  styleUrls: ['./customers-view.component.css']
})
export class CustomersViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);

  public customers = signal<Customer[]>([]);
  public filteredCustomers = signal<Customer[]>([]);
  public shop = signal<Shop | null>(null);
  public searchQuery = '';
  public selectedCustomer = signal<Customer | null>(null);

  // Form modal
  public isModalOpen = signal<boolean>(false);
  public isEditing = signal<boolean>(false);
  public formModel = {
    id: '',
    name: '',
    phone: '',
    address: '',
    lat: 16.2452,
    lng: 103.2501
  };

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup = L.layerGroup();

  ngOnInit() {
    this.loadData();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private loadData() {
    this.api.getShopInfo().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (this.map) {
          this.renderMarkers();
        }
      }
    });

    this.api.getCustomers().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.filterCustomers();
        if (this.map) {
          this.renderMarkers();
        }
      }
    });
  }

  private initMap() {
    this.map = L.map('customers-map', {
      center: [16.2452, 103.2501],
      zoom: 14
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
    this.renderMarkers();
  }

  private renderMarkers() {
    if (!this.map) return;
    this.markersLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    // Shop Marker
    if (this.shop()) {
      bounds.extend([this.shop()!.lat, this.shop()!.lng]);
      const shopIcon = L.divIcon({
        className: 'custom-shop-icon',
        html: `
          <div class="shop-marker-pin w-9 h-9 flex items-center justify-center bg-orange-600 text-white rounded-full shadow-md font-bold text-xs border-2 border-white">
            🏪
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      L.marker([this.shop()!.lat, this.shop()!.lng], { icon: shopIcon })
        .bindPopup(`<strong>${this.shop()!.name}</strong>`)
        .addTo(this.markersLayer);
    }

    // Customer Markers
    this.filteredCustomers().forEach((cust) => {
      bounds.extend([cust.lat, cust.lng]);

      const custIcon = L.divIcon({
        className: 'custom-cust-icon',
        html: `
          <div class="w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow text-[10px] font-bold border border-white">
            📍
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([cust.lat, cust.lng], { icon: custIcon });
      marker.bindPopup(`
        <div class="p-2 text-xs">
          <div class="font-bold text-slate-800 text-sm mb-1">${cust.name}</div>
          <div class="text-slate-500 mb-1">${cust.address}</div>
          <div class="text-blue-600 font-semibold mb-2">📞 ${cust.phone}</div>
          <div class="text-[10px] text-slate-400">พิกัด: ${cust.lat}, ${cust.lng}</div>
        </div>
      `);
      marker.addTo(this.markersLayer);
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  public filterCustomers() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredCustomers.set(this.customers());
    } else {
      this.filteredCustomers.set(
        this.customers().filter(
          c => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q) || c.phone.includes(q)
        )
      );
    }
    this.renderMarkers();
  }

  public openCustomer(cust: Customer) {
    this.selectedCustomer.set(cust);
    if (this.map) {
      this.map.flyTo([cust.lat, cust.lng], 16);
    }
  }

  public openAddModal() {
    this.isEditing.set(false);
    this.formModel = {
      id: '',
      name: '',
      phone: '',
      address: '',
      lat: 16.2452 + (Math.random() - 0.5) * 0.015,
      lng: 103.2501 + (Math.random() - 0.5) * 0.015
    };
    this.isModalOpen.set(true);
  }

  public openEditModal(cust: Customer) {
    this.isEditing.set(true);
    this.formModel = { ...cust };
    this.isModalOpen.set(true);
  }

  public saveCustomer() {
    if (!this.formModel.name || !this.formModel.phone || !this.formModel.address) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (this.isEditing()) {
      this.api.updateCustomer(this.formModel.id, this.formModel).subscribe({
        next: () => {
          this.isModalOpen.set(false);
          this.loadData();
        }
      });
    } else {
      this.api.addCustomer(this.formModel).subscribe({
        next: () => {
          this.isModalOpen.set(false);
          this.loadData();
        }
      });
    }
  }

  public deleteCustomer(id: string) {
    if (confirm('ยืนยันลบข้อมูลลูกค้านี้?')) {
      this.api.deleteCustomer(id).subscribe({
        next: () => this.loadData()
      });
    }
  }
}

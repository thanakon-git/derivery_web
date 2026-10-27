import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { DeliveryPlan, RiderRoute, Shop } from '../../core/models/delivery.models';

/** แปลงนาทีนับจากเวลาออกส่ง 11:30 → "HH:MM น." รองรับเกิน 60 นาที */
function formatArrivalTime(minutesFromDeparture: number): string {
  const DEPARTURE_HOUR = 11;
  const DEPARTURE_MINUTE = 30;
  const totalMinutes = DEPARTURE_HOUR * 60 + DEPARTURE_MINUTE + minutesFromDeparture;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')} น.`;
}

@Component({
  selector: 'app-routes-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './routes-view.component.html',
  styleUrls: ['./routes-view.component.css']
})
export class RoutesViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);

  public shop = signal<Shop | null>(null);
  public plan = signal<DeliveryPlan | null>(null);
  public selectedRoute = signal<RiderRoute | null>(null);
  public selectedStrategy = signal<'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY'>('SMART_CLUSTER');
  public isLoading = signal<boolean>(false);
  public orderCount = signal<number>(0);
  public feedbackMessage = signal<string | null>(null);

  private map: L.Map | null = null;
  private routeLayers: L.LayerGroup = L.layerGroup();
  private markerLayers: L.LayerGroup = L.layerGroup();

  ngOnInit() {
    this.loadInitialData();
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

  private loadInitialData() {
    this.api.getShopInfo().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (this.map) {
          this.map.setView([shop.lat, shop.lng], 14);
          this.renderShopMarker(shop);
        }
      }
    });

    this.api.getOrders().subscribe({
      next: (orders) => {
        this.orderCount.set(orders.length);
        if (orders.length > 0) {
          this.loadCurrentPlan();
        }
      }
    });
  }

  private loadCurrentPlan() {
    this.api.getCurrentPlan().subscribe({
      next: (plan) => {
        if (plan && plan.routes && plan.routes.length > 0) {
          this.plan.set(plan);
          this.renderRoutesOnMap(plan);
        }
      }
    });
  }

  private initMap() {
    const el = document.getElementById('delivery-map');
    if (!el) {
      setTimeout(() => this.initMap(), 150);
      return;
    }

    if (this.map) {
      this.map.invalidateSize();
      return;
    }

    const centerLat = this.shop()?.lat || 16.2452;
    const centerLng = this.shop()?.lng || 103.2501;

    try {
      this.map = L.map('delivery-map', {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      this.routeLayers.addTo(this.map);
      this.markerLayers.addTo(this.map);

      if (this.shop()) {
        this.renderShopMarker(this.shop()!);
      }

      if (this.plan()) {
        this.renderRoutesOnMap(this.plan()!);
      }

      setTimeout(() => {
        this.map?.invalidateSize();
      }, 200);
    } catch (err) {
      console.error('Error initializing map:', err);
    }
  }

  private renderShopMarker(shop: Shop) {
    if (!this.map) return;

    const shopIcon = L.divIcon({
      className: 'custom-shop-icon',
      html: `
        <div class="shop-marker-pin w-10 h-10 flex items-center justify-center bg-orange-600 text-white rounded-full shadow-lg border-2 border-white ring-4 ring-orange-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });

    const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon });
    marker.bindPopup(`
      <div class="p-3 text-sm">
        <div class="font-bold text-orange-600 text-base mb-1">🏪 ${shop.name}</div>
        <p class="text-slate-600 mb-1">${shop.address}</p>
        <div class="text-xs bg-orange-100 text-orange-800 rounded px-2 py-1 inline-block font-semibold">
          ⏰ จุดเริ่มส่ง 11:30 น.
        </div>
      </div>
    `);
    marker.addTo(this.map);
  }

  private renderRoutesOnMap(plan: DeliveryPlan) {
    if (!this.map) {
      this.initMap();
    }
    if (!this.map) return;

    this.routeLayers.clearLayers();
    this.markerLayers.clearLayers();

    if (this.shop()) {
      this.renderShopMarker(this.shop()!);
    }

    const currentSelected = this.selectedRoute();
    const bounds = L.latLngBounds([]);
    if (this.shop()) {
      bounds.extend([this.shop()!.lat, this.shop()!.lng]);
    }

    plan.routes.forEach((route) => {
      const color = route.riderColor;
      const isSelected = currentSelected?.jobCode === route.jobCode;
      const opacity = currentSelected ? (isSelected ? 1.0 : 0.15) : 0.85;
      const weight = isSelected ? 6 : (currentSelected ? 2 : 4);

      if (currentSelected && isSelected) {
        bounds.extend([this.shop()?.lat || 16.2452, this.shop()?.lng || 103.2501]);
        route.stops.forEach(s => bounds.extend([s.lat, s.lng]));
      } else if (!currentSelected) {
        route.stops.forEach(s => bounds.extend([s.lat, s.lng]));
      }

      // Draw route line
      const latlngs: L.LatLngExpression[] = route.waypoints.map(wp => [wp.lat, wp.lng]);
      const polyline = L.polyline(latlngs, {
        color,
        weight,
        opacity,
        dashArray: isSelected ? undefined : '5, 8'
      });

      polyline.on('click', () => {
        this.selectRoute(route);
      });

      polyline.addTo(this.routeLayers);

      // Draw stops
      route.stops.forEach((stop) => {
        const stopOpacity = currentSelected ? (isSelected ? 1.0 : 0.25) : 1.0;

        const stopIcon = L.divIcon({
          className: 'custom-stop-icon',
          html: `
            <div style="background-color: ${color}; opacity: ${stopOpacity};" class="rider-marker-pin w-7 h-7 flex items-center justify-center text-white rounded-full font-bold text-xs shadow-md border-2 border-white ring-2 ${isSelected ? 'ring-black scale-125' : 'ring-black/20'}">
              ${stop.stopNumber}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
        });

        const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon, opacity: stopOpacity });
        marker.bindPopup(`
          <div class="p-3 text-sm min-w-[220px]">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="w-3 h-3 rounded-full" style="background-color: ${color}"></span>
              <span class="font-bold text-slate-800">${route.riderName} (จุดที่ ${stop.stopNumber})</span>
            </div>
            <div class="font-semibold text-slate-700">${stop.customerName}</div>
            <div class="text-xs text-slate-500 mb-2">${stop.address}</div>
            <div class="grid grid-cols-2 gap-2 text-xs bg-slate-100 p-2 rounded mb-2">
              <div>จำนวน: <strong class="text-orange-600">${stop.boxCount} กล่อง</strong></div>
              <div>ระยะ: <strong>${stop.distanceFromPrevKm} กม.</strong></div>
              <div class="col-span-2">คาดถึงเวลา: <strong>${formatArrivalTime(stop.estimatedArrivalMinutesFromStart)}</strong></div>
            </div>
            <a href="${stop.googleMapsUrl}" target="_blank" class="block text-center py-1.5 px-3 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
              🗺️ เปิด Google Maps นำทาง
            </a>
          </div>
        `);

        marker.addTo(this.markerLayers);
      });
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 150);
  }

  public selectRoute(route: RiderRoute | null) {
    if (this.selectedRoute()?.jobCode === route?.jobCode) {
      this.selectedRoute.set(null); // toggle off
    } else {
      this.selectedRoute.set(route);
    }
    if (this.plan()) {
      this.renderRoutesOnMap(this.plan()!);
    }
  }

  public simulateLunchRush() {
    this.isLoading.set(true);
    this.api.simulateOrders(25).subscribe({
      next: (orders) => {
        this.orderCount.set(orders.length);
        this.optimizeRoutes();
      },
      error: (err) => {
        console.error('Error simulating orders:', err);
        this.isLoading.set(false);
      }
    });
  }

  public optimizeRoutes() {
    this.isLoading.set(true);
    this.feedbackMessage.set(null);
    this.api.optimizeRoutes(this.selectedStrategy()).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.selectedRoute.set(null);
        this.renderRoutesOnMap(plan);
        this.isLoading.set(false);
        const stratName = this.getStrategyName(plan.optimizationStrategy);
        this.feedbackMessage.set(`✅ คำนวณและเสนอเส้นทางใหม่สำเร็จ! [${stratName}] ไรเดอร์ ${plan.totalRidersUsed} คัน | กำไรสุทธิ ฿${plan.netProfit.toFixed(2)} | ส่งเสร็จใน ${plan.maxTripDurationMinutes} นาที (ทันก่อน 12:30 น.)`);
      },
      error: (err) => {
        console.error('Error optimizing routes:', err);
        this.isLoading.set(false);
        this.feedbackMessage.set('❌ เกิดข้อผิดพลาดในการคำนวณเส้นทาง กรุณาลองใหม่อีกครั้ง');
      }
    });
  }

  public cycleStrategyAndOptimize() {
    const current = this.selectedStrategy();
    let next: 'SMART_CLUSTER' | 'MIN_RIDERS' | 'FASTEST_DELIVERY' = 'MIN_RIDERS';
    if (current === 'SMART_CLUSTER') next = 'MIN_RIDERS';
    else if (current === 'MIN_RIDERS') next = 'FASTEST_DELIVERY';
    else if (current === 'FASTEST_DELIVERY') next = 'SMART_CLUSTER';
    
    this.selectedStrategy.set(next);
    this.optimizeRoutes();
  }

  public getStrategyName(strat: string): string {
    switch (strat) {
      case 'MIN_RIDERS': return 'อัดแน่น 3 ออเดอร์/คน (ประหยัดไรเดอร์ กำไรสูงสุด)';
      case 'FASTEST_DELIVERY': return 'กระจายงานเร็วสุด (ส่งถึงลูกค้าไวที่สุด)';
      default: return 'แบ่งโซนตามมุมและระยะทาง (สมดุลที่สุด)';
    }
  }

  public clearAll() {
    if (confirm('คุณต้องการล้างรายการออเดอร์และเส้นทางทั้งหมดใช่หรือไม่?')) {
      this.api.clearOrders().subscribe({
        next: () => {
          this.orderCount.set(0);
          this.plan.set(null);
          this.selectedRoute.set(null);
          this.routeLayers.clearLayers();
          this.markerLayers.clearLayers();
          if (this.shop()) {
            this.renderShopMarker(this.shop()!);
          }
        }
      });
    }
  }
}

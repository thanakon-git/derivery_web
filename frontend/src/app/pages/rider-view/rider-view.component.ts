import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { RiderRoute, Shop } from '../../core/models/delivery.models';

@Component({
  selector: 'app-rider-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './rider-view.component.html',
  styleUrls: ['./rider-view.component.css']
})
export class RiderViewComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  public jobCodeInput = signal<string>('JOB-01');
  public currentJobCode = signal<string>('');
  public shop = signal<Shop | null>(null);
  public routeData = signal<RiderRoute | null>(null);
  public errorMessage = signal<string>('');
  public isLoading = signal<boolean>(false);
  public jobStatus = signal<'NOT_STARTED' | 'DELIVERING' | 'DELIVERED'>('NOT_STARTED');

  // Track completed stops locally
  public completedStops = signal<Set<number>>(new Set<number>());

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['job']) {
        this.jobCodeInput.set(params['job']);
        this.searchJob(params['job']);
      } else {
        this.searchJob('JOB-01');
      }
    });
  }

  public searchJob(code?: string) {
    const jobToFind = (code || this.jobCodeInput()).trim().toUpperCase();
    if (!jobToFind) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.api.getRiderJob(jobToFind).subscribe({
      next: (res) => {
        this.shop.set(res.shop);
        this.routeData.set(res.route);
        this.currentJobCode.set(res.route.jobCode);
        this.completedStops.set(new Set());
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Job not found:', err);
        this.routeData.set(null);
        this.errorMessage.set(
          err.error?.message || `ไม่พบใบงาน "${jobToFind}" กรุณาตรวจสอบรหัสใบงานอีกครั้ง (เช่น JOB-01, JOB-02)`
        );
        this.isLoading.set(false);
      }
    });
  }

  public selectQuickJob(code: string) {
    this.jobCodeInput.set(code);
    this.searchJob(code);
  }

  public toggleStopCompleted(stopNumber: number) {
    const nextSet = new Set(this.completedStops());
    if (nextSet.has(stopNumber)) {
      nextSet.delete(stopNumber);
    } else {
      nextSet.add(stopNumber);
    }
    this.completedStops.set(nextSet);

    if (this.routeData() && nextSet.size === this.routeData()!.stops.length) {
      this.jobStatus.set('DELIVERED');
      this.updateStatusOnBackend('DELIVERED');
    }
  }

  public markDelivering() {
    this.jobStatus.set('DELIVERING');
    this.updateStatusOnBackend('DELIVERING');
  }

  public markDelivered() {
    this.jobStatus.set('DELIVERED');
    if (this.routeData()) {
      const allStops = new Set(this.routeData()!.stops.map(s => s.stopNumber));
      this.completedStops.set(allStops);
    }
    this.updateStatusOnBackend('DELIVERED');
  }

  private updateStatusOnBackend(status: 'DELIVERING' | 'DELIVERED') {
    if (!this.currentJobCode()) return;
    this.api.updateJobStatus(this.currentJobCode(), status).subscribe({
      next: () => console.log(`Status updated to ${status}`),
      error: (err) => console.error('Failed to update status:', err)
    });
  }
}

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  public currentTime = signal<string>('11:30 AM');
  public isStartMenuOpen = signal<boolean>(false);
  private timer: any;

  ngOnInit() {
    this.updateClock();
    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.updateClock(), 1000);
    }
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private updateClock() {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
  }

  public toggleStartMenu() {
    this.isStartMenuOpen.update(v => !v);
  }

  public closeStartMenu() {
    this.isStartMenuOpen.set(false);
  }
}

import { Injectable, signal } from '@angular/core';

export type AppTheme = 'retro';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public currentTheme = signal<AppTheme>('retro'); // Locked to Windows 95 Retro!

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    if (typeof document !== 'undefined') {
      document.body.classList.add('theme-retro');
      document.body.classList.remove('theme-modern');
    }
  }

  public setTheme(theme: AppTheme = 'retro') {
    this.currentTheme.set('retro');
    if (typeof document !== 'undefined') {
      document.body.classList.add('theme-retro');
      document.body.classList.remove('theme-modern');
    }
  }

  public toggleTheme() {
    // Permanent Windows 95 theme
    this.setTheme('retro');
  }
}

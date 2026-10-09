import { Injectable, signal } from '@angular/core';

export type AppTheme = 'retro' | 'modern';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'lunchbox_delivery_theme';
  public currentTheme = signal<AppTheme>('retro'); // Default is Windows 95 Retro!

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
    const initial = saved === 'modern' ? 'modern' : 'retro'; // default retro
    this.setTheme(initial);
  }

  public setTheme(theme: AppTheme) {
    this.currentTheme.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);

    if (typeof document !== 'undefined') {
      if (theme === 'retro') {
        document.body.classList.add('theme-retro');
        document.body.classList.remove('theme-modern');
      } else {
        document.body.classList.add('theme-modern');
        document.body.classList.remove('theme-retro');
      }
    }
  }

  public toggleTheme() {
    const next = this.currentTheme() === 'retro' ? 'modern' : 'retro';
    this.setTheme(next);
  }
}

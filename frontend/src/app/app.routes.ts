import { Routes } from '@angular/router';
import { RoutesViewComponent } from './pages/routes-view/routes-view.component';
import { OrdersViewComponent } from './pages/orders-view/orders-view.component';
import { CustomersViewComponent } from './pages/customers-view/customers-view.component';
import { RiderViewComponent } from './pages/rider-view/rider-view.component';

export const routes: Routes = [
  { path: '', component: RoutesViewComponent, title: 'จัดเส้นทาง & แผนที่ - ส่งด่วนมื้อเที่ยง' },
  { path: 'routes', component: RoutesViewComponent, title: 'จัดเส้นทาง & แผนที่ - ส่งด่วนมื้อเที่ยง' },
  { path: 'orders', component: OrdersViewComponent, title: 'จัดการออเดอร์ - ส่งด่วนมื้อเที่ยง' },
  { path: 'customers', component: CustomersViewComponent, title: 'ข้อมูลลูกค้า - ส่งด่วนมื้อเที่ยง' },
  { path: 'rider', component: RiderViewComponent, title: 'ใบงานไรเดอร์ - ส่งด่วนมื้อเที่ยง' },
  { path: '**', redirectTo: '' }
];

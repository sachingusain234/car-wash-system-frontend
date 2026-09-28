import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { BookWashComponent } from './features/booking/book-wash/book-wash.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Sign In - CarWash Hub' },
  { path: 'register', component: RegisterComponent, title: 'Register - CarWash Hub' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard], title: 'Dashboard - CarWash Hub' },
  { path: 'book-wash', component: BookWashComponent, canActivate: [authGuard], title: 'Book Car Wash - CarWash Hub' },
  { path: '**', redirectTo: 'login' }
];

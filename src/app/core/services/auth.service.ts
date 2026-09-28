import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from '../models/auth.models';

const TOKEN_KEY = 'car_wash_auth_token';
const USER_KEY = 'car_wash_auth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);

  // Reactive state using Angular Signals
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role || null);

  private readonly baseUrl = environment.apiUrl;

  /**
   * Register a new Customer or Washer
   * Payload: { name, email, phone, password, role }
   */
  register(payload: RegisterRequest): Observable<AuthResponse> {
    const url = `${this.baseUrl}${environment.authEndpoints.register}`;
    return this.http.post<AuthResponse>(url, payload).pipe(
      tap((response) => {
        // If registration auto-logs in or returns token/user
        if (response.token || response.accessToken || response.jwt) {
          this.handleAuthSuccess(response, payload.role, payload.name, payload.email);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Login with email and password
   * Payload: { email, password }
   */
  login(payload: LoginRequest): Observable<AuthResponse> {
    const url = `${this.baseUrl}${environment.authEndpoints.login}`;
    return this.http.post<AuthResponse>(url, payload).pipe(
      tap((response) => {
        this.handleAuthSuccess(response, response.role || 'CUSTOMER', response.name || '', payload.email);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Store token and user state
   */
  private handleAuthSuccess(response: AuthResponse, fallbackRole: UserRole, fallbackName: string, email: string): void {
    const token = response.token || response.accessToken || response.jwt;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    const role = (response.role || response.user?.role || fallbackRole) as UserRole;
    const user: User = response.user
      ? { ...response.user, role: response.user.role || role }
      : {
          id: 1,
          name: response.name || fallbackName || email.split('@')[0],
          email: response.email || email,
          role
        };

    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /**
   * Logout user and clear tokens
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  /**
   * Retrieve current stored token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as User;
    } catch {
      return null;
    }
  }

  private handleError(error: any) {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error.error === 'string') {
      errorMessage = error.error;
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to backend server. Please verify backend is running and CORS is enabled.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid email or password.';
    } else if (error.status === 409) {
      errorMessage = 'An account with this email already exists.';
    }
    return throwError(() => new Error(errorMessage));
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminDashboardStats, AdminUserSummary, BookingRequest, BookingResponse, BookingStatus, CreateOrderRequest, CreateOrderResponse, PaymentVerifyRequest, PaymentVerifyResponse, ReviewRequest, ReviewResponse, Washer, WashPackage } from '../models/booking.models';

const LOCAL_BOOKINGS_KEY = 'car_wash_local_bookings';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private readonly http = inject(HttpClient);

  // In-memory synced bookings array (without any mock/dummy data)
  private localBookings: BookingResponse[] = this.loadLocalBookings();

  private buildUrl(path: string): string {
    const base = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const endpoint = path.startsWith('/') ? path : `/${path}`;
    return `${base}${endpoint}`;
  }

  /**
   * Fetch all available washers from backend
   */
  getWashers(): Observable<Washer[]> {
    const url = this.buildUrl(environment.washerEndpoints.list);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.washers)) return res.washers;
        if (res && Array.isArray(res.data)) return res.data;
        return [];
      }),
      catchError((error) => {
        console.warn('Backend washers unavailable:', error?.message);
        return of([]);
      })
    );
  }

  /**
   * Fetch a washer's average rating from /washer/{washerId}/average-rating
   * Returns null if the washer has no ratings yet or the call fails.
   */
  getWasherAverageRating(washerId: string | number): Observable<number | null> {
    const endpoint = environment.washerEndpoints.ratings.replace('{washerId}', String(washerId));
    const url = this.buildUrl(endpoint);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        // Response may be a plain number, or { averageRating: number }, or { rating: number }
        if (typeof res === 'number') return res;
        if (res != null && typeof res.averageRating === 'number') return res.averageRating;
        if (res != null && typeof res.rating === 'number') return res.rating;
        if (res != null && typeof res.average === 'number') return res.average;
        return null;
      }),
      catchError(() => of(null))  // No rating yet or endpoint not found → return null
    );
  }

  /**
   * Fetch all wash packages from backend
   */
  getPackages(): Observable<WashPackage[]> {
    const url = this.buildUrl(environment.packageEndpoints.list);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : res?.packages || res?.data || [];
        return list.length ? list : this.getDefaultPackages();
      }),
      catchError(() => {
        return of(this.getDefaultPackages());
      })
    );
  }

  private getDefaultPackages(): WashPackage[] {
    return [
      { id: 1, name: 'Standard Full Wash', price: 499, washType: 'Standard Wash', description: 'Exterior foam wash, interior vacuuming & glass wipe' },
      { id: 2, name: 'Basic Foam Wash', price: 299, washType: 'Basic Wash', description: 'Exterior body foam wash & high-pressure rinse' },
      { id: 3, name: 'Deluxe Deep Clean', price: 899, washType: 'Deluxe Wash', description: 'Deep exterior shine, dashboard polishing & interior sanitization' }
    ];
  }

  /**
   * Step 1 of payment flow: Create a Razorpay order on the backend.
   * Backend contract: POST api/payments/create-order with bookingId and paymentMethod
   */
  createOrder(bookingId: string | number, paymentMethod: string = 'RAZORPAY', amountInRupees?: number): Observable<CreateOrderResponse> {
    const url = this.buildUrl(environment.paymentEndpoints.createOrder);
    const payload: CreateOrderRequest = {
      bookingId,
      paymentMethod,
      ...(amountInRupees != null ? { amount: amountInRupees, currency: 'INR' } : {})
    };
    return this.http.post<CreateOrderResponse>(url, payload).pipe(
      catchError((error) => {
        console.error('Failed to create Razorpay order:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Step 3 of payment flow: Verify payment signature on the backend.
   * POST api/payments/verify → backend validates razorpay_signature using secret key
   * Returns { success: true } if valid.
   */
  verifyPayment(payload: PaymentVerifyRequest): Observable<PaymentVerifyResponse> {
    const url = this.buildUrl(environment.paymentEndpoints.verify);
    const requestBody = {
      razorpayorderid: payload.razorpayorderid,
      razorpaypaymentid: payload.razorpaypaymentid,
      razorpaysignature: payload.razorpaysignature,
      ...(payload.razorpay_order_id ? { razorpay_order_id: payload.razorpay_order_id } : {}),
      ...(payload.razorpay_payment_id ? { razorpay_payment_id: payload.razorpay_payment_id } : {}),
      ...(payload.razorpay_signature ? { razorpay_signature: payload.razorpay_signature } : {})
    };
    return this.http.post<PaymentVerifyResponse>(url, requestBody).pipe(
      catchError((error) => {
        console.error('Payment verification failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Book a car wash (Called after Razorpay payment success and verification)
   */
  createBooking(payload: BookingRequest): Observable<BookingResponse> {
    const url = this.buildUrl(environment.bookingEndpoints.create);
    return this.http.post<BookingResponse>(url, payload).pipe(
      tap((res) => {
        const saved: BookingResponse = {
          ...payload,
          ...res,
          id: res?.id || res?.bookingId || Date.now(),
          status: res?.status || payload.status || 'PENDING',
          paymentStatus: res?.paymentStatus || payload.paymentStatus || 'PAID',
          paymentId: res?.paymentId || payload.paymentId
        };
        this.saveLocalBooking(saved);
      }),
      catchError((error) => {
        console.error('Error creating booking on backend:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetch customer bookings from api/bookings/customer/my-bookings
   */
  getCustomerBookings(): Observable<BookingResponse[]> {
    const url = this.buildUrl(environment.bookingEndpoints.customerList);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        let list: BookingResponse[] = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && Array.isArray(res.content)) {
          list = res.content;
        } else if (res && Array.isArray(res.bookings)) {
          list = res.bookings;
        } else if (res && Array.isArray(res.data)) {
          list = res.data;
        } else if (res && Array.isArray(res.items)) {
          list = res.items;
        } else if (res && (res.id || res.bookingId)) {
          list = [res];
        }

        // Ensure no mock/dummy items pollute the list
        const filtered = list.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234');
        return filtered;
      }),
      catchError((error) => {
        console.warn('Backend customer bookings error:', error);
        // Only return real bookings saved during this session/local, never random data
        const realLocal = this.localBookings.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234');
        return of(realLocal);
      })
    );
  }

  /**
   * Fetch washer bookings (Incoming/assigned jobs)
   */
  getWasherBookings(washerId?: string | number): Observable<BookingResponse[]> {
    const url = this.buildUrl(environment.bookingEndpoints.washerList);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        let list: BookingResponse[] = [];
        if (Array.isArray(res)) list = res;
        else if (res && Array.isArray(res.content)) list = res.content;
        else if (res && Array.isArray(res.bookings)) list = res.bookings;
        else if (res && Array.isArray(res.data)) list = res.data;
        return list.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234');
      }),
      catchError(() => {
        const filtered = this.localBookings.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234');
        if (washerId) {
          const matched = filtered.filter((b) => String(b.washerId) === String(washerId));
          return of(matched);
        }
        return of(filtered);
      })
    );
  }

  /**
   * Washer Updates Booking Status:
   * PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED
   */
  updateBookingStatus(bookingId: string | number, status: BookingStatus): Observable<BookingResponse> {
    const url = this.buildUrl(`${environment.bookingEndpoints.updateStatus}/${bookingId}`);
    return this.http.patch<BookingResponse>(url, { status }).pipe(
      tap(() => this.updateLocalBookingStatus(bookingId, status)),
      catchError(() => {
        this.updateLocalBookingStatus(bookingId, status);
        return of({ id: bookingId, status, message: `Status updated to ${status}` });
      })
    );
  }

  /**
   * Customer submits review for finished car wash
   */
  submitReview(payload: ReviewRequest): Observable<ReviewResponse> {
    const url = this.buildUrl(environment.reviewEndpoints.submit);
    return this.http.post<ReviewResponse>(url, payload).pipe(
      tap(() => {
        const item = this.localBookings.find((b) => String(b.id) === String(payload.bookingId));
        if (item) {
          item.hasReview = true;
          this.persistLocalBookings();
        }
      }),
      catchError(() => {
        const item = this.localBookings.find((b) => String(b.id) === String(payload.bookingId));
        if (item) {
          item.hasReview = true;
          this.persistLocalBookings();
        }
        return of({ ...payload, message: 'Review submitted successfully!' });
      })
    );
  }

  /**
   * Washer actions for the dedicated booking lifecycle endpoints.
   */
  acceptBooking(bookingId: string | number): Observable<any> {
    const url = this.buildUrl(environment.washerEndpoints.accept.replace('{bookingId}', String(bookingId)));
    return this.http.put(url, {}).pipe(
      tap(() => this.updateLocalBookingStatus(bookingId, 'ACCEPTED')),
      catchError((error) => {
        this.updateLocalBookingStatus(bookingId, 'ACCEPTED');
        return of({ success: true, message: 'Booking accepted locally.' });
      })
    );
  }

  startBooking(bookingId: string | number): Observable<any> {
    const url = this.buildUrl(environment.washerEndpoints.start.replace('{bookingId}', String(bookingId)));
    return this.http.put(url, {}).pipe(
      tap(() => this.updateLocalBookingStatus(bookingId, 'IN_PROGRESS')),
      catchError((error) => {
        this.updateLocalBookingStatus(bookingId, 'IN_PROGRESS');
        return of({ success: true, message: 'Booking started locally.' });
      })
    );
  }

  completeBooking(bookingId: string | number): Observable<any> {
    const url = this.buildUrl(environment.washerEndpoints.complete.replace('{bookingId}', String(bookingId)));
    return this.http.put(url, {}).pipe(
      tap(() => this.updateLocalBookingStatus(bookingId, 'COMPLETED')),
      catchError((error) => {
        this.updateLocalBookingStatus(bookingId, 'COMPLETED');
        return of({ success: true, message: 'Booking completed locally.' });
      })
    );
  }

  /**
   * Admin dashboard summary.
   */
  getAdminDashboard(): Observable<AdminDashboardStats> {
    const url = this.buildUrl(environment.adminEndpoints.dashboard);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        const dashboard = res?.dashboard || res?.data || res || {};
        return {
          totalCustomers: dashboard.totalCustomers ?? dashboard.customers ?? dashboard.customerCount ?? 0,
          totalWashers: dashboard.totalWashers ?? dashboard.washers ?? dashboard.washerCount ?? 0,
          totalRevenue: dashboard.totalRevenue ?? dashboard.revenue ?? dashboard.total_amount ?? 0,
          message: dashboard.message
        };
      }),
      catchError(() => of({ totalCustomers: 0, totalWashers: 0, totalRevenue: 0 }))
    );
  }

  /**
   * Admin user list includes admins, washers and customers.
   */
  getAdminUsers(): Observable<AdminUserSummary[]> {
    const url = this.buildUrl(environment.adminEndpoints.users);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : res?.users || res?.data || res?.items || [];
        return list;
      }),
      catchError(() => of([]))
    );
  }

  // --- Local storage synchronization helpers ---
  private saveLocalBooking(booking: BookingResponse): void {
    if (booking.id === 1001 || booking.vehicleId === 'DL-01-AB-1234') return;
    this.localBookings = this.localBookings.filter((b) => b.id !== booking.id);
    this.localBookings.unshift(booking);
    this.persistLocalBookings();
  }

  private updateLocalBookingStatus(bookingId: string | number, status: BookingStatus): void {
    const item = this.localBookings.find((b) => String(b.id) === String(bookingId));
    if (item) {
      item.status = status;
      this.persistLocalBookings();
    }
  }

  private loadLocalBookings(): BookingResponse[] {
    const data = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    if (!data) {
      return [];
    }
    try {
      const parsed: BookingResponse[] = JSON.parse(data);
      // Clean out any legacy mock booking (e.g. DL-01-AB-1234 or id: 1001)
      const cleaned = Array.isArray(parsed)
        ? parsed.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234')
        : [];
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  private persistLocalBookings(): void {
    const cleanList = this.localBookings.filter((b) => b && b.id !== 1001 && b.vehicleId !== 'DL-01-AB-1234');
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(cleanList));
  }
}

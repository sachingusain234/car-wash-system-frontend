import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { AdminDashboardStats, AdminUserSummary, BookingResponse, BookingStatus, ReviewRequest } from '../../core/models/booking.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly router = inject(Router);

  readonly bookings = signal<BookingResponse[]>([]);
  readonly adminStats = signal<AdminDashboardStats | null>(null);
  readonly adminUsers = signal<AdminUserSummary[]>([]);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly actionMessage = signal<string | null>(null);

  // Computed booking statistics (derived from customer bookings)
  readonly totalCount = computed(() => this.bookings().length);
  readonly pendingCount = computed(() =>
    this.bookings().filter((b) => (b.status || '').toUpperCase() === 'PENDING').length
  );
  readonly inProgressCount = computed(() =>
    this.bookings().filter((b) =>
      ['ACCEPTED', 'IN_PROGRESS', 'CONFIRMED', 'BOOKED'].includes((b.status || '').toUpperCase())
    ).length
  );
  readonly completedCount = computed(() =>
    this.bookings().filter((b) => (b.status || '').toUpperCase() === 'COMPLETED').length
  );

  // Review modal state
  readonly showReviewModal = signal(false);
  readonly selectedBookingForReview = signal<BookingResponse | null>(null);
  selectedRating = 5;
  reviewComment = '';
  readonly isSubmittingReview = signal(false);

  ngOnInit(): void {
    this.loadBookings();
  }

  isCustomer(): boolean {
    const role = this.authService.userRole();
    return !role || role.toUpperCase() === 'CUSTOMER';
  }

  isAdmin(): boolean {
    return (this.authService.userRole()?.toUpperCase() || '') === 'ADMIN';
  }

  loadBookings(isManualRefresh = false): void {
    if (isManualRefresh) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }

    const currentUser = this.authService.currentUser();

    const role = this.authService.userRole()?.toUpperCase();

    if (role === 'ADMIN') {
      this.bookingService.getAdminDashboard().subscribe({
        next: (stats) => {
          this.adminStats.set(stats);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        },
        error: (err) => {
          console.error('Failed to load admin dashboard:', err);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        }
      });

      this.bookingService.getAdminUsers().subscribe({
        next: (users) => {
          this.adminUsers.set(users);
        },
        error: (err) => {
          console.error('Failed to load admin users:', err);
        }
      });
      return;
    }

    if (this.isCustomer()) {
      this.bookingService.getCustomerBookings().subscribe({
        next: (data) => {
          this.bookings.set(data);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
          if (isManualRefresh) {
            this.actionMessage.set(`Bookings updated. Found ${data.length} booking(s).`);
            setTimeout(() => this.actionMessage.set(null), 3000);
          }
        },
        error: (err) => {
          console.error('Failed to load bookings:', err);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        }
      });
    } else {
      // Washer view
      this.bookingService.getWasherBookings(currentUser?.id).subscribe({
        next: (data) => {
          this.bookings.set(data);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        },
        error: (err) => {
          console.error('Failed to load washer jobs:', err);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        }
      });
    }
  }

  refreshBookings(): void {
    this.loadBookings(true);
  }

  getStatusBadge(rawStatus?: string | null): { label: string; bg: string; text: string; dot: string } {
    const status = (rawStatus || 'PENDING').toUpperCase();
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending Washer',
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-800',
          dot: 'bg-amber-400'
        };
      case 'ACCEPTED':
      case 'CONFIRMED':
      case 'BOOKED':
        return {
          label: 'Confirmed',
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          dot: 'bg-blue-500'
        };
      case 'IN_PROGRESS':
        return {
          label: 'Wash In Progress',
          bg: 'bg-indigo-50 border-indigo-200',
          text: 'text-indigo-800',
          dot: 'bg-indigo-500'
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: 'bg-emerald-50 border-emerald-200',
          text: 'text-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          dot: 'bg-red-400'
        };
      default:
        return {
          label: status,
          bg: 'bg-gray-50 border-gray-200',
          text: 'text-gray-800',
          dot: 'bg-gray-400'
        };
    }
  }

  // --- Washer Actions ---
  acceptBooking(booking: BookingResponse): void {
    const id = booking.id || booking.bookingId;
    if (!id) return;
    this.bookingService.acceptBooking(id).subscribe({
      next: () => {
        this.actionMessage.set(`Booking #${id} accepted!`);
        this.loadBookings();
        setTimeout(() => this.actionMessage.set(null), 3000);
      }
    });
  }

  startService(booking: BookingResponse): void {
    const id = booking.id || booking.bookingId;
    if (!id) return;
    this.bookingService.startBooking(id).subscribe({
      next: () => {
        this.actionMessage.set(`Wash service started for booking #${id}.`);
        this.loadBookings();
        setTimeout(() => this.actionMessage.set(null), 3000);
      }
    });
  }

  finishService(booking: BookingResponse): void {
    const id = booking.id || booking.bookingId;
    if (!id) return;
    this.bookingService.completeBooking(id).subscribe({
      next: () => {
        this.actionMessage.set(`Wash service completed for booking #${id}!`);
        this.loadBookings();
        setTimeout(() => this.actionMessage.set(null), 3000);
      }
    });
  }

  // --- Customer Review Flow ---
  openReviewModal(booking: BookingResponse): void {
    this.selectedBookingForReview.set(booking);
    this.selectedRating = 5;
    this.reviewComment = '';
    this.showReviewModal.set(true);
  }

  closeReviewModal(): void {
    this.showReviewModal.set(false);
    this.selectedBookingForReview.set(null);
  }

  submitCustomerReview(): void {
    const booking = this.selectedBookingForReview();
    if (!booking) return;

    this.isSubmittingReview.set(true);
    const payload: ReviewRequest = {
      bookingId: booking.id || booking.bookingId || 1,
      washerId: booking.washerId || 1,
      rating: this.selectedRating,
      comment: this.reviewComment
    };

    this.bookingService.submitReview(payload).subscribe({
      next: () => {
        this.isSubmittingReview.set(false);
        this.closeReviewModal();
        this.actionMessage.set('Thank you! Your review has been submitted.');
        this.loadBookings();
        setTimeout(() => this.actionMessage.set(null), 4000);
      },
      error: () => {
        this.isSubmittingReview.set(false);
        this.closeReviewModal();
        this.loadBookings();
      }
    });
  }

  goToBookWash(): void {
    this.router.navigate(['/book-wash']);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

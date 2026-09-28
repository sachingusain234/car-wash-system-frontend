import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { BookingResponse, BookingStatus, ReviewRequest } from '../../core/models/booking.models';

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
  readonly isLoading = signal(true);
  readonly actionMessage = signal<string | null>(null);

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

  loadBookings(): void {
    this.isLoading.set(true);
    const currentUser = this.authService.currentUser();

    if (this.isCustomer()) {
      this.bookingService.getCustomerBookings().subscribe({
        next: (data) => {
          this.bookings.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else {
      // Washer view
      this.bookingService.getWasherBookings(currentUser?.id).subscribe({
        next: (data) => {
          this.bookings.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    }
  }

  // --- Washer Actions ---
  acceptBooking(booking: BookingResponse): void {
    const id = booking.id || booking.bookingId;
    if (!id) return;
    this.bookingService.updateBookingStatus(id, 'ACCEPTED').subscribe({
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
    this.bookingService.updateBookingStatus(id, 'IN_PROGRESS').subscribe({
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
    this.bookingService.updateBookingStatus(id, 'COMPLETED').subscribe({
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

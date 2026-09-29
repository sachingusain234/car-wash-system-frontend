import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { RazorpayService } from '../../../core/services/razorpay.service';
import { BookingRequest, Washer, WashPackage } from '../../../core/models/booking.models';

@Component({
  selector: 'app-book-wash',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './book-wash.component.html',
  styleUrl: './book-wash.component.css'
})
export class BookWashComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly authService = inject(AuthService);
  private readonly razorpayService = inject(RazorpayService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly isProcessingPayment = signal(false);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Dynamic lists from backend
  readonly washers = signal<Washer[]>([]);
  readonly packages = signal<WashPackage[]>([]);

  // Tracks the currently selected package reactively (avoids form-value timing bugs)
  readonly selectedPackage = signal<WashPackage | null>(null);
  // Tracks the currently selected washer reactively
  readonly selectedWasher = signal<Washer | null>(null);

  // Today's date in YYYY-MM-DD
  readonly today = new Date().toISOString().split('T')[0];

  readonly bookingForm: FormGroup = this.fb.group({
    vehicleId: ['', [Validators.required]],
    washerId: [''],
    packageId: ['', [Validators.required]],
    washType: ['Standard Wash', [Validators.required]],
    scheduledDate: [this.today, [Validators.required]],
    startTime: ['10:00', [Validators.required]],
    location: ['', [Validators.required, Validators.minLength(3)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadWashersAndPackages();
  }

  loadWashersAndPackages(): void {
    this.isLoading.set(true);

    // Fetch washers with their avg ratings from API
    this.bookingService.getWashers().subscribe({
      next: (data) => {
        // Fetch avg rating for each washer from backend
        const washerList: Washer[] = data.map((w) => ({ ...w, averageRating: undefined }));
        this.washers.set(washerList);

        // For each washer, try to fetch their average rating
        washerList.forEach((washer, idx) => {
          this.bookingService.getWasherAverageRating(washer.id).subscribe({
            next: (avgRating) => {
              const updated = [...this.washers()];
              updated[idx] = { ...updated[idx], averageRating: avgRating };
              this.washers.set(updated);
              // Update selected washer signal if this is the selected one
              const current = this.selectedWasher();
              if (current && String(current.id) === String(washer.id)) {
                this.selectedWasher.set(updated[idx]);
              }
            },
            error: () => {
              // Leave averageRating as null if rating API fails
            }
          });
        });

        if (data.length > 0 && !this.bookingForm.get('washerId')?.value) {
          const firstAvailable = data.find((w) => w.available !== false) || data[0];
          this.bookingForm.patchValue({ washerId: firstAvailable.id });
          this.selectedWasher.set(firstAvailable);
        }
      },
      error: (err) => {
        console.error('Error fetching washers:', err);
        this.washers.set([]);
      }
    });

    // Fetch packages
    this.bookingService.getPackages().subscribe({
      next: (data) => {
        this.packages.set(data);
        if (data.length > 0 && !this.bookingForm.get('packageId')?.value) {
          const firstPkg = data[0];
          this.bookingForm.patchValue({
            packageId: firstPkg.id,
            washType: firstPkg.washType || firstPkg.name
          });
          this.selectedPackage.set(firstPkg);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching packages:', err);
        this.isLoading.set(false);
      }
    });
  }

  onPackageChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedPkgId = select.value;
    const pkg = this.packages().find((p) => String(p.id) === String(selectedPkgId)) ?? null;
    // Update reactive signal immediately — avoids timing issue with form.value
    this.selectedPackage.set(pkg);
    if (pkg) {
      this.bookingForm.patchValue({
        washType: pkg.washType || pkg.name
      });
    }
  }

  onWasherChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedWasherId = select.value;
    const washer = this.washers().find((w) => String(w.id) === String(selectedWasherId)) ?? null;
    this.selectedWasher.set(washer);
  }

  getSelectedPackage(): WashPackage | undefined {
    const currentSelection = this.selectedPackage();
    if (currentSelection) {
      return currentSelection;
    }

    const selectedPackageId = this.bookingForm.get('packageId')?.value;
    if (!selectedPackageId) {
      return undefined;
    }

    return this.packages().find((pkg) => String(pkg.id) === String(selectedPackageId)) ?? undefined;
  }

  getSelectedWasher(): Washer | undefined {
    return this.selectedWasher() ?? undefined;
  }

  /**
   * Returns formatted rating string for display.
   * Priority: averageRating from API > static rating field > null
   * Returns null when washer has no ratings at all.
   */
  formatWasherRating(washer: Washer): string | null {
    if (washer.averageRating != null) {
      return washer.averageRating.toFixed(1);
    }
    if (washer.rating != null) {
      return Number(washer.rating).toFixed(1);
    }
    if (washer.ratings != null) {
      return Number(washer.ratings).toFixed(1);
    }
    return null;
  }

  /**
   * User clicks Book -> triggers Razorpay payment -> on success, saves booking
   */
  async onSubmit(): Promise<void> {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formValues = this.bookingForm.value;
    const selectedPkg = this.getSelectedPackage();
    const pkgAmount = selectedPkg?.price ?? 499;

    const currentUser = this.authService.currentUser();
    const customerName = currentUser?.name || 'Customer';
    const customerEmail = currentUser?.email || 'customer@example.com';
    const customerPhone = currentUser?.phone || '9876543210';

    this.isSubmitting.set(true);

    // Format startTime to LocalTime format (HH:mm:ss)
    let formattedTime = formValues.startTime;
    if (formattedTime && formattedTime.length === 5) {
      formattedTime = `${formattedTime}:00`;
    }

    const normalizedWasherId = formValues.washerId != null && formValues.washerId !== '' && !Number.isNaN(Number(formValues.washerId)) ? Number(formValues.washerId) : undefined;
    const normalizedPackageId = formValues.packageId != null && formValues.packageId !== '' && !Number.isNaN(Number(formValues.packageId)) ? Number(formValues.packageId) : undefined;

    const payload: any = {
      vehicleId: formValues.vehicleId,
      bookingDate: this.today,
      scheduledDate: formValues.scheduledDate || formValues.scheculedDate,
      location: formValues.location,
      notes: formValues.notes || '',
      status: 'PENDING',
      washType: formValues.washType || selectedPkg?.name || 'Standard Wash',
      startTime: formattedTime
    };

    if (normalizedWasherId != null) {
      payload.washerId = normalizedWasherId;
    }

    if (normalizedPackageId != null) {
      payload.packageId = normalizedPackageId;
    }

    this.bookingService.createBooking(payload).subscribe({
      next: async (createdBooking) => {
        const bookingId = createdBooking?.id ?? createdBooking?.bookingId ?? payload.id;

        if (!bookingId) {
          this.isSubmitting.set(false);
          this.errorMessage.set('Booking ID is missing. Payment cannot be started.');
          return;
        }

        try {
          this.isProcessingPayment.set(true);
          const orderResponse = await this.bookingService.createOrder(bookingId, 'RAZORPAY', pkgAmount).toPromise();
          const orderId = orderResponse?.orderId || orderResponse?.order_id || orderResponse?.id;

          if (!orderId) {
            throw new Error('Razorpay order ID was not returned by the backend.');
          }

          const paymentResult = await this.razorpayService.pay({
            amount: pkgAmount,
            description: `Car Wash: ${selectedPkg?.name || formValues.washType || 'Standard Service'}`,
            customerName,
            customerEmail,
            customerPhone
          }, orderId);

          const verifyResponse = await this.bookingService.verifyPayment({
            razorpayorderid: paymentResult.orderId,
            razorpaypaymentid: paymentResult.paymentId,
            razorpaysignature: paymentResult.signature
          }).toPromise();

          this.isSubmitting.set(false);
          this.isProcessingPayment.set(false);

          if (verifyResponse && verifyResponse.success === false) {
            throw new Error(verifyResponse.message || 'Payment verification failed.');
          }

          this.successMessage.set(
            `Payment of ₹${pkgAmount} successful! Razorpay Ref: ${paymentResult.paymentId}. Status: Pending Washer Acceptance. Redirecting to your bookings...`
          );
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        } catch (err: any) {
          this.isSubmitting.set(false);
          this.isProcessingPayment.set(false);
          this.errorMessage.set(err?.message || 'Payment failed. Please try again.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.message || 'Failed to create booking before payment.');
      }
    });
  }
}

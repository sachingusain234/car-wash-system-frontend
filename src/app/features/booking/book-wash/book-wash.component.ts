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

  // Today's date in YYYY-MM-DD
  readonly today = new Date().toISOString().split('T')[0];

  readonly bookingForm: FormGroup = this.fb.group({
    vehicleId: ['', [Validators.required]],
    washerId: ['', [Validators.required]],
    packageId: ['', [Validators.required]],
    washType: ['Standard Wash', [Validators.required]],
    scheculedDate: [this.today, [Validators.required]],
    startTime: ['10:00', [Validators.required]],
    location: ['', [Validators.required, Validators.minLength(3)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadWashersAndPackages();
  }

  loadWashersAndPackages(): void {
    this.isLoading.set(true);

    // Fetch washers
    this.bookingService.getWashers().subscribe({
      next: (data) => {
        this.washers.set(data);
        if (data.length > 0 && !this.bookingForm.get('washerId')?.value) {
          const firstAvailable = data.find((w) => w.available !== false) || data[0];
          this.bookingForm.patchValue({ washerId: firstAvailable.id });
        }
      },
      error: (err) => console.error('Error fetching washers:', err)
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
    const pkg = this.packages().find((p) => String(p.id) === String(selectedPkgId));
    if (pkg) {
      this.bookingForm.patchValue({
        washType: pkg.washType || pkg.name
      });
    }
  }

  getSelectedPackage(): WashPackage | undefined {
    const pkgId = this.bookingForm.get('packageId')?.value;
    return this.packages().find((p) => String(p.id) === String(pkgId));
  }

  getSelectedWasher(): Washer | undefined {
    const washerId = this.bookingForm.get('washerId')?.value;
    return this.washers().find((w) => String(w.id) === String(washerId));
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
    const pkgAmount = selectedPkg?.price || 499;

    const currentUser = this.authService.currentUser();
    const customerName = currentUser?.name || 'Customer';
    const customerEmail = currentUser?.email || 'customer@example.com';
    const customerPhone = currentUser?.phone || '9876543210';

    this.isProcessingPayment.set(true);

    try {
      // 1. Trigger Razorpay checkout modal
      const paymentResult = await this.razorpayService.pay({
        amount: pkgAmount,
        description: `Car Wash: ${selectedPkg?.name || 'Standard Service'}`,
        customerName,
        customerEmail,
        customerPhone
      });

      this.isProcessingPayment.set(false);
      this.isSubmitting.set(true);

      // Format startTime to LocalTime format (HH:mm:ss)
      let formattedTime = formValues.startTime;
      if (formattedTime && formattedTime.length === 5) {
        formattedTime = `${formattedTime}:00`;
      }

      // 2. Prepare and send Booking Request DTO
      const payload: BookingRequest = {
        vehicleId: formValues.vehicleId,
        washerId: formValues.washerId,
        packageId: formValues.packageId,
        bookingDate: this.today,
        scheculedDate: formValues.scheculedDate,
        location: formValues.location,
        notes: formValues.notes || '',
        washType: formValues.washType,
        startTime: formattedTime,
        status: 'PENDING',
        amount: pkgAmount,
        paymentId: paymentResult.paymentId,
        paymentStatus: 'PAID'
      };

      this.bookingService.createBooking(payload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.successMessage.set(
            `Payment of ₹${pkgAmount} successful (Ref: ${paymentResult.paymentId})! Your car wash is booked.`
          );
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1800);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err.message || 'Booking submission failed. Please contact support.');
        }
      });
    } catch (err: any) {
      this.isProcessingPayment.set(false);
      this.isSubmitting.set(false);
      this.errorMessage.set(err.message || 'Payment cancelled. Please try again.');
    }
  }
}

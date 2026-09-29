import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RazorpayOptions } from '../models/booking.models';

declare var Razorpay: any;

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  private scriptLoaded = false;

  loadRazorpayScript(): Promise<boolean> {
    if (this.scriptLoaded && typeof Razorpay !== 'undefined') {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('Razorpay SDK failed to load.');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  /**
   * Opens Razorpay checkout modal.
   * @param options Payment details
   * @param orderId  The order_id returned by api/payments/create-order (required for signature verification)
   * @returns razorpay_payment_id, razorpay_order_id, razorpay_signature — all needed for api/payments/verify
   */
  pay(
    options: {
      amount: number;       // in INR rupees
      description: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    },
    orderId?: string
  ): Promise<{
    paymentId: string;
    orderId: string;
    signature: string;
    status: 'PAID';
  }> {
    return new Promise(async (resolve, reject) => {
      const loaded = await this.loadRazorpayScript();

      if (loaded && typeof Razorpay !== 'undefined') {
        const razorpayOptions: RazorpayOptions = {
          key: environment.razorpayKey,
          amount: Math.round(options.amount * 100), // convert to paise
          currency: 'INR',
          name: 'CarWash Hub',
          description: options.description,
          order_id: orderId,  // attach server-side order id (eliminates 401 errors)
          prefill: {
            name: options.customerName,
            email: options.customerEmail,
            contact: options.customerPhone
          },
          theme: {
            color: '#2563eb'
          },
          handler: (response: any) => {
            // Razorpay provides all 3 fields needed for backend signature verification
            resolve({
              paymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
              orderId: response.razorpay_order_id || orderId || `order_${Date.now()}`,
              signature: response.razorpay_signature || '',
              status: 'PAID'
            });
          },
          modal: {
            ondismiss: () => {
              reject(new Error('Payment cancelled by user.'));
            }
          }
        };

        try {
          const rzp = new Razorpay(razorpayOptions);
          rzp.open();
          return;
        } catch (err) {
          console.warn('Could not launch Razorpay window, using fallback:', err);
        }
      }

      // Simulated fallback if Razorpay SDK is unavailable (no internet / dev mode)
      const proceed = confirm(
        `[Razorpay Checkout Simulator]\n\nPay ₹${options.amount} for "${options.description}"?\n\nClick OK to simulate successful payment, or Cancel to abort.`
      );
      if (proceed) {
        resolve({
          paymentId: `sim_pay_${Date.now()}`,
          orderId: orderId || `sim_order_${Date.now()}`,
          signature: `sim_sig_${Date.now()}`,
          status: 'PAID'
        });
      } else {
        reject(new Error('Payment cancelled by user.'));
      }
    });
  }
}

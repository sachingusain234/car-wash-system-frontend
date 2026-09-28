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
        console.warn('Razorpay SDK failed to load. Fallback simulation available.');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  pay(options: {
    amount: number; // in INR rupees
    description: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  }): Promise<{ paymentId: string; status: 'PAID' }> {
    return new Promise(async (resolve, reject) => {
      const loaded = await this.loadRazorpayScript();

      // If Razorpay SDK loaded and is available
      if (loaded && typeof Razorpay !== 'undefined') {
        const razorpayOptions: RazorpayOptions = {
          key: environment.razorpayKey,
          amount: Math.round(options.amount * 100), // convert to paise
          currency: 'INR',
          name: 'CarWash Hub',
          description: options.description,
          prefill: {
            name: options.customerName,
            email: options.customerEmail,
            contact: options.customerPhone
          },
          theme: {
            color: '#2563eb'
          },
          handler: (response: any) => {
            resolve({
              paymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
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
          console.warn('Could not launch Razorpay window, using fallback test simulator:', err);
        }
      }

      // Simulated sandbox fallback if internet checkout script is unavailable
      const proceed = confirm(
        `[Razorpay Checkout Simulator]\n\nPay ₹${options.amount} for "${options.description}"?\n\nClick OK to simulate successful payment, or Cancel to abort.`
      );
      if (proceed) {
        resolve({
          paymentId: `sim_pay_${Date.now()}`,
          status: 'PAID'
        });
      } else {
        reject(new Error('Payment cancelled by user.'));
      }
    });
  }
}

export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Washer {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  rating?: number;         // Static rating from backend user record
  ratings?: number;        // Alias used by some backends
  averageRating?: number | null; // Fetched from avg-rating API endpoint (null = no ratings yet)
  available?: boolean;
}

export interface WashPackage {
  id: string | number;
  name: string;
  description?: string;
  price?: number;
  washType?: string;
}

export interface BookingRequest {
  id?: string | number;
  vehicleId: string | number;
  washerId?: string | number;
  packageId?: string | number;
  bookingDate: string;    // Format: YYYY-MM-DD
  scheduledDate?: string; // Format: YYYY-MM-DD
  location: string;
  notes?: string;
  washType: string;       // e.g. Basic Wash, Standard Wash, Deluxe Wash, Full Detailing
  startTime: string;      // Format: HH:mm or HH:mm:ss (LocalTime)
  status?: BookingStatus | string;
  amount?: number;
  paymentId?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | string;
}

export interface BookingResponse {
  id?: string | number;
  bookingId?: string | number;
  vehicleId?: string | number;
  washerId?: string | number;
  packageId?: string | number;
  bookingDate?: string;
  scheduledDate?: string;
  scheculedDate?: string; // compatibility with older backend payloads
  location?: string;
  notes?: string;
  washType?: string;
  startTime?: string;
  status?: BookingStatus | string;
  amount?: number;
  paymentId?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | string;
  washerName?: string;
  packageName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  message?: string;
  hasReview?: boolean;
}

export interface ReviewRequest {
  bookingId: string | number;
  washerId: string | number;
  rating: number; // 1 to 5
  comment: string;
}

export interface ReviewResponse {
  id?: string | number;
  bookingId?: string | number;
  washerId?: string | number;
  rating?: number;
  comment?: string;
  message?: string;
}

export interface AdminDashboardStats {
  totalCustomers?: number;
  totalWashers?: number;
  totalRevenue?: number;
  customers?: number;
  washers?: number;
  revenue?: number;
  message?: string;
}

export interface AdminUserSummary {
  id?: string | number;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  available?: boolean;
}

export interface RazorpayOptions {
  key: string;
  amount: number; // In paise (e.g. 5000 = Rs 50)
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

/** Sent to POST api/payments/create-order */
export interface CreateOrderRequest {
  bookingId: string | number;
  paymentMethod: string;
  amount?: number;
  currency?: string;
}

/** Response from POST api/payments/create-order */
export interface CreateOrderResponse {
  orderId?: string;
  order_id?: string;  // Some backends return snake_case
  id?: string;        // Razorpay's raw order id field
  amount?: number;    // in paise
  currency?: string;
  status?: string;
}

/** Sent to POST api/payments/verify */
export interface PaymentVerifyRequest {
  razorpayorderid: string;
  razorpaypaymentid: string;
  razorpaysignature: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

/** Response from POST api/payments/verify */
export interface PaymentVerifyResponse {
  success?: boolean;
  verified?: boolean;
  status?: string;
  message?: string;
  paymentId?: string;
}

export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Washer {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  rating?: number;
  ratings?: number;
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
  washerId: string | number;
  packageId: string | number;
  bookingDate: string;    // Format: YYYY-MM-DD
  scheculedDate: string;  // Format: YYYY-MM-DD
  location: string;
  notes?: string;
  washType: string;       // e.g. Basic Wash, Standard Wash, Deluxe Wash, Full Detailing
  startTime: string;      // Format: HH:mm or HH:mm:ss (LocalTime)
  status?: BookingStatus | string;
  amount?: number;
  paymentId?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
}

export interface BookingResponse {
  id?: string | number;
  bookingId?: string | number;
  vehicleId?: string | number;
  washerId?: string | number;
  packageId?: string | number;
  bookingDate?: string;
  scheculedDate?: string;
  location?: string;
  notes?: string;
  washType?: string;
  startTime?: string;
  status?: BookingStatus | string;
  amount?: number;
  paymentId?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
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

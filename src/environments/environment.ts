export const environment = {
  production: false,
  // Update this to your backend laptop's IP and port
  apiUrl: 'http://192.168.0.101:8080/',
  razorpayKey: 'rzp_test_TaNzlWsdT2KF', // Default Razorpay Test Key (replace with your key if needed)
  authEndpoints: {
    login: 'api/auth/login',
    register: 'api/auth/register'
  },
  bookingEndpoints: {
    create: 'api/bookings/customer',
    customerList: 'api/bookings/customer/my-bookings',
    washerList: 'api/bookings/washer/my-bookings',
    updateStatus: 'api/bookings/status' // e.g. /api/bookings/status/{id}
  },
  washerEndpoints: {
    list: 'api/users/washers',
    ratings: '/washer/{washerId}/average-rating',
    accept: 'api/bookings/washer/{bookingId}/accept',
    start: 'api/bookings/washer/{bookingId}/start',
    complete: 'api/bookings/washer/{bookingId}/complete',
    myBookings: 'api/bookings/washer/my-bookings'
  },
  packageEndpoints: {
    list: 'api/bookings/customer/packages'
  },
  reviewEndpoints: {
    submit: 'api/reviews'
  },
  paymentEndpoints: {
    createOrder: 'api/payments/create-order',  // POST { amount, currency }
    verify: 'api/payments/verify'              // POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  },
  adminEndpoints: {
    dashboard: 'api/admin/dashboard',
    users: 'api/admin/users'
  }
};

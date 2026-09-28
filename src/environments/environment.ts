export const environment = {
  production: false,
  // Update this to your backend laptop's IP and port
  apiUrl: 'http://192.168.0.101:8080/',
  razorpayKey: 'rzp_test_1DP5mmOlF5G5ag', // Default Razorpay Test Key (replace with your key if needed)
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
    list: 'api/washers'
  },
  packageEndpoints: {
    list: 'api/packages'
  },
  reviewEndpoints: {
    submit: 'api/reviews'
  }
};

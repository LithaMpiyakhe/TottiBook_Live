// Yoco Configuration
// Note: In production, these should be environment variables
export const YOCO_CONFIG = {
  // Public key for client-side integration
  PUBLIC_KEY: process.env.VITE_YOCO_PUBLIC_KEY || 'pk_test_1234567890abcdef',
  
  // Test mode flag
  TEST_MODE: process.env.VITE_YOCO_TEST_MODE !== 'false',
  
  // Currency
  CURRENCY: 'ZAR',
  
  // Company name for payment descriptions
  COMPANY_NAME: 'Totti Shuttle Service',
};

// Pricing configuration
export const SHUTTLE_PRICING = {
  BASE_PRICE: 325,
  GROUP_DISCOUNTS: {
    5: 0.05,  // 5% discount for 5+ passengers
    10: 0.10, // 10% discount for 10+ passengers
  },
};

export function calculateTotalPrice(passengers: number): number {
  const basePrice = SHUTTLE_PRICING.BASE_PRICE * passengers;
  let discount = 0;
  
  // Apply group discounts
  for (const [minPassengers, discountRate] of Object.entries(SHUTTLE_PRICING.GROUP_DISCOUNTS)) {
    if (passengers >= parseInt(minPassengers)) {
      discount = discountRate;
    }
  }
  
  const discountAmount = basePrice * discount;
  return basePrice - discountAmount;
}

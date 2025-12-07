// Pricing configuration for Totti Shuttle Service
export const SHUTTLE_PRICING = {
  // Base price per passenger in ZAR
  BASE_PRICE_PER_PASSENGER: 325,
  
  // Route-specific pricing (if different from base)
  ROUTE_PRICING: {
    "Mthatha_to_KingPhalo": 325,
    "KingPhalo_to_Mthatha": 325,
    // Queenstown routes priced at R280
    "Queenstown_to_KingPhalo": 280,
    "KingPhalo_to_Queenstown": 280,
  },
  
  // Group discounts
  GROUP_DISCOUNTS: {
    5: 0.05,  // 5% discount for 5+ passengers
    10: 0.10, // 10% discount for 10+ passengers
  },
};

export interface PricingBreakdown {
  basePrice: number;
  passengerCount: number;
  route: string;
  subtotal: number;
  discount: number;
  total: number;
}

export function calculateShuttlePrice(
  route: string, 
  passengerCount: number
): PricingBreakdown {
  const routePrice = SHUTTLE_PRICING.ROUTE_PRICING[route as keyof typeof SHUTTLE_PRICING.ROUTE_PRICING] || 
                     SHUTTLE_PRICING.BASE_PRICE_PER_PASSENGER;
  
  const basePrice = routePrice;
  const subtotal = basePrice * passengerCount;
  
  // Calculate discount based on passenger count
  let discount = 0;
  for (const [minPassengers, discountRate] of Object.entries(SHUTTLE_PRICING.GROUP_DISCOUNTS)) {
    if (passengerCount >= parseInt(minPassengers)) {
      discount = discountRate;
    }
  }
  
  const discountAmount = subtotal * discount;
  const total = subtotal - discountAmount;
  
  return {
    basePrice,
    passengerCount,
    route,
    subtotal,
    discount: discountAmount,
    total,
  };
}

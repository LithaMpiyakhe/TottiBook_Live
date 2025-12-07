// API service for handling bookings and payment confirmations
export interface BookingData {
  route: string;
  date: string;
  time: string;
  passengers: number;
  name: string;
  email: string;
  phone: string;
  amount: number;
  paymentId?: string;
  paymentStatus?: string;
}

export interface PaymentResult {
  id: string;
  status: string;
  amount: number;
  currency: string;
  created: string;
  // Add other Yoco payment result fields as needed
}

// Mock API service - replace with actual backend calls
export const bookingService = {
  async createBooking(bookingData: BookingData): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate booking ID
      const bookingId = `TOTTI-${Date.now()}`;
      
      // Store booking in localStorage for demo purposes
      const bookings = JSON.parse(localStorage.getItem('totti_bookings') || '[]');
      bookings.push({
        ...bookingData,
        bookingId,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('totti_bookings', JSON.stringify(bookings));
      
      console.log('Booking created:', { bookingId, bookingData });
      
      return { success: true, bookingId };
    } catch (error) {
      console.error('Booking creation failed:', error);
      return { success: false, error: 'Failed to create booking' };
    }
  },

  async confirmPayment(bookingId: string, paymentResult: PaymentResult): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const bookings = JSON.parse(localStorage.getItem('totti_bookings') || '[]');
      const bookingIndex = bookings.findIndex((b: any) => b.bookingId === bookingId);
      
      if (bookingIndex === -1) {
        return { success: false, error: 'Booking not found' };
      }
      
      // Update booking with payment details
      bookings[bookingIndex] = {
        ...bookings[bookingIndex],
        paymentId: paymentResult.id,
        paymentStatus: paymentResult.status,
        paymentConfirmedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('totti_bookings', JSON.stringify(bookings));
      
      console.log('Payment confirmed:', { bookingId, paymentResult });
      
      return { success: true };
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      return { success: false, error: 'Failed to confirm payment' };
    }
  },

  async getBooking(bookingId: string): Promise<BookingData | null> {
    try {
      const bookings = JSON.parse(localStorage.getItem('totti_bookings') || '[]');
      return bookings.find((b: any) => b.bookingId === bookingId) || null;
    } catch (error) {
      console.error('Failed to get booking:', error);
      return null;
    }
  },
};
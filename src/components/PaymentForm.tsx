import React, { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showSuccess, showError } from "@/utils/toast";
import { createCheckout } from "@/services/yocoService";

interface BookingSummary { route: string; passengers: number }
interface PaymentFormProps {
  amount: number;
  bookingData: BookingSummary;
  onPaymentSuccess: (paymentResult: { id: string; status: string }) => void;
  onPaymentCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  bookingData,
  onPaymentSuccess,
  onPaymentCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  useEffect(() => {
    // In future, readiness can check env vars or a health check to backend
    setIsReady(true);
  }, []);

  const handlePayment = async () => {
    if (!isReady) {
      showError("Payment system is not ready. Please try again.");
      return;
    }

    setIsProcessing(true);
    try {
      const clientRef = `TOTTI-${Date.now()}`;
      const checkout = await createCheckout({
        amountInRands: amount,
        currency: "ZAR",
        metadata: { route: bookingData.route, passengers: bookingData.passengers },
        clientReferenceId: clientRef,
      });

      if (checkout?.redirectUrl) {
        setCheckoutId(checkout.id || null);
        setRedirectUrl(checkout.redirectUrl);
        try {
          window.location.assign(checkout.redirectUrl);
        } catch (_) {
          showError("Redirect blocked. Click the button to open payment page.");
        }
        return;
      }

      showError("Could not start Yoco checkout.");
    } catch (error) {
      console.error("Yoco checkout error:", error);
      setErrorDetail(error instanceof Error ? error.message : String(error));
      showError("Payment processing failed. Please review the message below and try again.");
      // Stay on Payment step to show error and manual link
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center space-x-2">
          <CreditCard className="h-6 w-6" />
          <span>Payment</span>
        </CardTitle>
        <CardDescription>
          Secure payment powered by Yoco
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg bg-secondary/30">
          <h3 className="font-bold text-lg mb-2 text-primary">Payment Summary</h3>
          <div className="space-y-1">
            <p><strong>Route:</strong> {bookingData.route}</p>
            <p><strong>Passengers:</strong> {bookingData.passengers}</p>
            <p><strong>Amount:</strong> R{amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          You'll be redirected to Yoco's secure payment page to complete your booking.
        </div>

        <div className="flex justify-between space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onPaymentCancel} 
            className="flex-1"
            disabled={isProcessing}
          >
            Back
          </Button>
          <Button 
            type="button" 
            onClick={handlePayment} 
            className="flex-1"
            disabled={!isReady || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Pay Now'
            )}
          </Button>
        </div>
        {redirectUrl && (
          <div className="pt-3 text-center">
            <a href={redirectUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              Open payment page
            </a>
          </div>
        )}
        {checkoutId && (
          <div className="pt-1 text-xs text-center text-muted-foreground">Checkout ID: {checkoutId}</div>
        )}
        {errorDetail && (
          <div className="pt-3 text-xs text-destructive text-center break-words">
            {errorDetail}
          </div>
        )}
        {errorDetail && (
          <div className="pt-2 text-center">
            <Button type="button" variant="secondary" onClick={handlePayment} disabled={isProcessing}>
              Retry Payment
            </Button>
          </div>
        )}
        <div className="text-xs text-center text-muted-foreground pt-2">
          Use test card 4111 1111 1111 1111, any future expiry, CVC 111.
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;
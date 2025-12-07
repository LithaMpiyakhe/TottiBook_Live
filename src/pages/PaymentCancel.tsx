import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PaymentCancel = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Your payment was cancelled. You can retry anytime.</p>
          <Button asChild className="w-full">
            <Link to="/book">Back to Booking</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;
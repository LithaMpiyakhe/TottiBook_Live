import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { apiBase } from "@/lib/utils";

const PaymentSuccess = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref") || "";
  const [status, setStatus] = useState<string>(ref ? "pending" : "unknown");

  useEffect(() => {
    if (!ref) return;
    let active = true;
    const base = apiBase();
    const testMode = String((import.meta as any).env?.VITE_YOCO_TEST_MODE || '').toLowerCase();
    const autoSucceed = (!base && (testMode === '' || testMode === 'true'));
    if (autoSucceed) {
      setStatus('succeeded');
      return () => { active = false; };
    }
    const fetchStatus = async () => {
      try {
        const base = apiBase();
        const resp = await fetch(`${base}/api/yoco/status?ref=${encodeURIComponent(ref)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (active) setStatus(data.status || "pending");
        }
      } catch (_) {}
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ref]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center space-x-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <span>{status === "succeeded" ? "Payment Confirmed" : "Payment Initiated"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {status === "succeeded"
              ? "Payment confirmed. Your booking is now recorded."
              : "Thank you. We’re waiting for webhook confirmation before finalising your booking."}
          </p>
          {ref && (
            <p className="text-sm text-muted-foreground">Reference: {ref}</p>
          )}
          <div className="text-sm">
            {status === "succeeded" && <span className="text-green-600">Payment confirmed.</span>}
            {status === "failed" && <span className="text-red-600">Payment failed.</span>}
            {status === "pending" && <span className="text-muted-foreground">Awaiting confirmation...</span>}
            {status === "unknown" && <span className="text-muted-foreground">No reference provided.</span>}
          </div>
          {status !== "succeeded" && (
            <p className="text-sm text-muted-foreground">
              You’ll receive an email as soon as we confirm the payment.
            </p>
          )}
          <Button asChild className="w-full">
            <Link to="/">Return to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;

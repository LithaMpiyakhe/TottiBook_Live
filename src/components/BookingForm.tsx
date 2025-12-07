import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Bus, User, CheckCircle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, apiBase } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { showSuccess, showError } from "@/utils/toast";
import PaymentForm from "@/components/PaymentForm";
import { calculateShuttlePrice } from "@/utils/pricing";
import { bookingService } from "@/services/bookingService";

// --- Zod Schema ---
const bookingSchema = z.object({
  route: z.enum(["Mthatha_to_KingPhalo", "KingPhalo_to_Mthatha", "Queenstown_to_KingPhalo", "KingPhalo_to_Queenstown"], {
    required_error: "Please select a route.",
  }),
  date: z.date({
    required_error: "A date is required.",
  }),
  time: z.string().min(1, "A time slot is required."),
  passengers: z.coerce.number().min(1, "Must book at least 1 passenger.").max(10, "Max 10 passengers per booking."),
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(10, "Phone number is required."),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

// Mock data for time slots based on the schedule in ShuttleSchedule.tsx
const timeSlots = [
  { route: "Mthatha_to_KingPhalo", time: "4:00 AM" },
  { route: "KingPhalo_to_Mthatha", time: "7:30 AM" },
  { route: "Mthatha_to_KingPhalo", time: "11:00 AM" },
  { route: "KingPhalo_to_Mthatha", time: "2:30 PM" },
  { route: "Queenstown_to_KingPhalo", time: "6:00 AM" },
  { route: "KingPhalo_to_Queenstown", time: "3:00 PM" },
];

const BookingForm: React.FC = () => {
  const base = apiBase();
  const [step, setStep] = useState(1);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      route: "Mthatha_to_KingPhalo",
      passengers: 1,
      name: "",
      email: "",
      phone: "",
      time: "",
    },
  });

  const { trigger, getValues, watch } = form;
  const selectedRoute = watch("route");
  const passengerCount = watch("passengers");
  const [qtnStats, setQtnStats] = useState<{count:number;threshold:number}|null>(null);
  const [qtnEnabled, setQtnEnabled] = useState<boolean>(true);
  const [qtnRoutes, setQtnRoutes] = useState<{Queenstown_to_KingPhalo:boolean;KingPhalo_to_Queenstown:boolean}>({ Queenstown_to_KingPhalo: true, KingPhalo_to_Queenstown: true });
  const selectedDate = watch("date");
  const selectedTime = watch("time");

  useEffect(() => {
    (async () => {
      if (selectedRoute?.includes('Queenstown') && selectedDate && selectedTime) {
        try {
          const dateStr = selectedDate.toISOString().slice(0,10);
          const resp = await fetch(`${base}/api/queenstown/stats?date=${dateStr}&time=${encodeURIComponent(selectedTime)}`);
          if (resp.ok) {
            const data = await resp.json();
            setQtnStats({ count: data.count, threshold: data.threshold });
          }
        } catch (_) {}
      } else {
        setQtnStats(null);
      }
    })();
  }, [selectedRoute, selectedDate, selectedTime]);

  // Calculate price based on current form values
  const getPrice = () => {
    if (!selectedRoute || !passengerCount) return 0;
    const pricing = calculateShuttlePrice(selectedRoute, passengerCount);
    return pricing.total;
  };

  const onSubmit = async (data: BookingFormValues) => {
    // This will only be called after successful payment
    console.log("Booking submitted:", data);
    console.log("Payment result:", paymentResult);
    
    try {
      // Create booking with payment confirmation
      const bookingData = {
        route: data.route,
        date: data.date.toISOString(),
        time: data.time,
        passengers: data.passengers,
        name: data.name,
        email: data.email,
        phone: data.phone,
        amount: getPrice(),
        paymentId: paymentResult?.id,
        paymentStatus: paymentResult?.status,
      };

      const result = await bookingService.createBooking(bookingData);
      
      if (result.success) {
        setBookingId(result.bookingId || null);
        showSuccess("Booking confirmed! Payment successful.");
        setStep(5); // Move to success screen
      } else {
        showError("Failed to create booking. Please contact support.");
      }
    } catch (error) {
      console.error("Booking submission failed:", error);
      showError("An error occurred while processing your booking.");
    }
  };

  const handlePaymentSuccess = (paymentResult: any) => {
    setPaymentResult(paymentResult);
    // After successful payment, submit the form
    form.handleSubmit(onSubmit)();
  };

  const handlePaymentCancel = () => {
    setStep(3); // Go back to review step
  };

  const handleNext = async (currentStep: number) => {
    let fieldsToValidate: (keyof BookingFormValues)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ["route", "date", "time"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["passengers", "name", "email", "phone"];
    }

    const isValid = await trigger(fieldsToValidate, { shouldFocus: true });

    if (isValid) {
      setStep(currentStep + 1);
    }
  };

  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{date:string; route:string; time:string}[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${base}/api/calendar/blocked`);
        if (resp.ok) {
          const data = await resp.json();
          setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
          setBlockedSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      } catch (_) {}
      try {
        const cfg = await fetch(`${base}/api/queenstown/config`);
        if (cfg.ok) {
          const d = await cfg.json();
          setQtnEnabled(!!d.enabled);
          if (d.routes) setQtnRoutes({
            Queenstown_to_KingPhalo: !!d.routes.Queenstown_to_KingPhalo,
            KingPhalo_to_Queenstown: !!d.routes.KingPhalo_to_Queenstown,
          });
        }
      } catch (_) {}
      try {
        const raw = localStorage.getItem('totti_qtn_config');
        if (raw) {
          const d = JSON.parse(raw);
          setQtnEnabled(!!d.enabled);
          if (d.routes) setQtnRoutes({
            Queenstown_to_KingPhalo: !!d.routes.Queenstown_to_KingPhalo,
            KingPhalo_to_Queenstown: !!d.routes.KingPhalo_to_Queenstown,
          });
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    const handler = async () => {
      try {
        const resp = await fetch(`${base}/api/calendar/blocked`);
        if (resp.ok) {
          const data = await resp.json();
          setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
          setBlockedSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      } catch (_) {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blocked-update', handler);
      return () => window.removeEventListener('blocked-update', handler);
    }
    return;
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('totti_qtn_config');
        if (raw) {
          const d = JSON.parse(raw);
          setQtnEnabled(!!d.enabled);
          if (d.routes) setQtnRoutes({
            Queenstown_to_KingPhalo: !!d.routes.Queenstown_to_KingPhalo,
            KingPhalo_to_Queenstown: !!d.routes.KingPhalo_to_Queenstown,
          });
        }
      } catch (_) {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('qtn-config-update', handler);
      return () => window.removeEventListener('qtn-config-update', handler);
    }
    return;
  }, []);

  const renderStep1 = () => (
    <>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center space-x-2">
          <Bus className="h-6 w-6" />
          <span>Step 1: Route & Date</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="route"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Select Route</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Mthatha_to_KingPhalo" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Mthatha → King Phalo Airport
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="KingPhalo_to_Mthatha" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      King Phalo Airport → Mthatha
                    </FormLabel>
                  </FormItem>
                  {qtnEnabled && qtnRoutes.Queenstown_to_KingPhalo && (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="Queenstown_to_KingPhalo" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Queenstown → King Phalo Airport (Subject to demand)
                      </FormLabel>
                    </FormItem>
                  )}
                  {qtnEnabled && qtnRoutes.KingPhalo_to_Queenstown && (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="KingPhalo_to_Queenstown" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        King Phalo Airport → Queenstown (Subject to demand)
                      </FormLabel>
                    </FormItem>
                  )}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Departure Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => {
                      const today = new Date();
                      const yyyyMmDd = date.toISOString().slice(0,10);
                      return date < today || blockedDates.includes(yyyyMmDd);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Time Slot</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-2 gap-2"
                >
                  {timeSlots
                    .filter(slot => slot.route === selectedRoute)
                    .map((slot) => (
                      <FormItem key={slot.time} className="flex items-center space-x-3 space-y-0 border p-3 rounded-md hover:bg-secondary/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value={slot.time} disabled={!!blockedSlots.find(s => selectedRoute === s.route && s.time === slot.time && (form.getValues('date') && form.getValues('date').toISOString().slice(0,10) === s.date))} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          {slot.time}
                        </FormLabel>
                      </FormItem>
                    ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="button" onClick={() => handleNext(1)} className="w-full">
          Next: Contact Details
        </Button>
      </CardContent>
    </>
  );

  const renderStep2 = () => (
    <>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center space-x-2">
          <User className="h-6 w-6" />
          <span>Step 2: Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="passengers"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Passengers</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="081 234 5678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
            Back
          </Button>
          <Button type="button" onClick={() => handleNext(2)} className="flex-1">
            Next: Review
          </Button>
        </div>
      </CardContent>
    </>
  );

  const renderStep3 = () => {
    const data = getValues();
    const routeDisplay =
      data.route === "Mthatha_to_KingPhalo" ? "Mthatha → King Phalo Airport" :
      data.route === "KingPhalo_to_Mthatha" ? "King Phalo Airport → Mthatha" :
      data.route === "Queenstown_to_KingPhalo" ? "Queenstown → King Phalo Airport" :
      "King Phalo Airport → Queenstown";
    
    const price = getPrice();
    const pricing = calculateShuttlePrice(data.route, data.passengers);

    return (
      <>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center space-x-2">
            <CheckCircle className="h-6 w-6" />
            <span>Step 3: Review Booking</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 p-4 border rounded-lg bg-secondary/30">
            <h3 className="font-bold text-lg mb-2 text-primary">Booking Summary</h3>
            <p><strong>Route:</strong> {routeDisplay}</p>
            <p><strong>Date:</strong> {format(data.date, "PPP")}</p>
            <p><strong>Time:</strong> {data.time}</p>
            <p><strong>Passengers:</strong> {data.passengers}</p>
          </div>
          <div className="space-y-2 p-4 border rounded-lg bg-secondary/30">
            <h3 className="font-bold text-lg mb-2 text-primary">Contact Details</h3>
            <p><strong>Name:</strong> {data.name}</p>
            <p><strong>Email:</strong> {data.email}</p>
            <p><strong>Phone:</strong> {data.phone}</p>
          </div>
          <div className="space-y-2 p-4 border rounded-lg bg-primary/10">
            <h3 className="font-bold text-lg mb-2 text-primary">Pricing Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Base price per passenger:</span>
                <span>R{pricing.basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal ({pricing.passengerCount} passengers):</span>
                <span>R{pricing.subtotal.toFixed(2)}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Group discount:</span>
                  <span>-R{pricing.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>R{pricing.total.toFixed(2)}</span>
              </div>
              {selectedRoute.includes('Queenstown') && qtnStats && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Demand: {qtnStats.count} of {qtnStats.threshold} seats requested
                </div>
              )}
            </div>
          </div>
          
          {data.route.includes("Queenstown") ? (
            <p className="text-sm text-muted-foreground pt-2">Subject to demand. Submit your request and we will confirm.</p>
          ) : (
            <p className="text-sm text-muted-foreground pt-2">Click "Continue to Payment" to proceed with secure payment via Yoco.</p>
          )}

          <div className="flex justify-between space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
              Back
            </Button>
            {data.route.includes("Queenstown") ? (
              <Button type="button" onClick={() => setStep(4)} className="flex-1">Continue</Button>
            ) : (
              <Button type="button" onClick={() => setStep(4)} className="flex-1">Continue to Payment</Button>
            )}
          </div>
        </CardContent>
      </>
    );
  };

  const renderStep4 = () => {
    const data = getValues();
    const price = getPrice();
    if (data.route.includes("Queenstown")) {
      const submitRequest = async () => {
        try {
          const resp = await fetch(`${base}/api/queenstown/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              route: data.route,
              date: data.date.toISOString().slice(0,10),
              time: data.time,
              passengers: data.passengers,
              name: data.name,
              email: data.email,
              phone: data.phone,
            }),
          });
          if (resp.ok) {
            const r = await resp.json();
            setQtnStats({ count: r.count, threshold: r.threshold });
            showSuccess('Request submitted. We will notify you.');
            setStep(5);
            return;
          }
        } catch (_) {}
        showError('Failed to submit request.');
      };
      return (
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 p-4 border rounded-lg bg-secondary/30">
            <h3 className="font-bold text-lg mb-2 text-primary">Queenstown Ride Request</h3>
            <p>Route: {data.route === "Queenstown_to_KingPhalo" ? "Queenstown → King Phalo Airport" : "King Phalo Airport → Queenstown"}</p>
            <p>Date: {format(data.date, "PPP")}</p>
            <p>Time: {data.time}</p>
            <p>Passengers: {data.passengers}</p>
            {qtnStats && (
              <p>{qtnStats.count} of {qtnStats.threshold} seats requested</p>
            )}
          </div>
          <Button type="button" onClick={submitRequest} className="w-full">Submit Request</Button>
        </CardContent>
      );
    }
    return (
      <PaymentForm
        amount={price}
        bookingData={{
          route: data.route === "Mthatha_to_KingPhalo" ? "Mthatha → King Phalo Airport" : "King Phalo Airport → Mthatha",
          passengers: data.passengers,
          date: data.date.toISOString().slice(0,10),
          time: data.time,
          name: data.name,
          email: data.email,
          phone: data.phone,
        }}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentCancel={handlePaymentCancel}
      />
    );
  };

  const renderSuccess = () => {
    const data = getValues();
    const pricing = calculateShuttlePrice(data.route, data.passengers);

    return (
      <>
        <CardHeader>
          {(!paymentResult && data.route.includes("Queenstown")) ? (
            <CardTitle className="text-2xl flex items-center space-x-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-6 w-6" />
              <span>Request Submitted</span>
            </CardTitle>
          ) : (
            <CardTitle className="text-2xl flex items-center space-x-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-6 w-6" />
              <span>Booking & Payment Confirmed!</span>
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {(!paymentResult && data.route.includes("Queenstown")) ? (
            <p className="text-lg">Thank you. We will confirm when this trip meets demand.</p>
          ) : (
            <p className="text-lg">Thank you for booking with Totti Shuttle Service.</p>
          )}
          {bookingId && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Booking Reference:</strong> {bookingId}
              </p>
            </div>
          )}
          <div className="p-4 border rounded-lg bg-secondary/30 text-left">
            <h3 className="font-bold text-lg mb-2 text-primary">Booking Details</h3>
            <p><strong>Route:</strong> {data.route === "Mthatha_to_KingPhalo" ? "Mthatha → King Phalo Airport" : data.route === "KingPhalo_to_Mthatha" ? "King Phalo Airport → Mthatha" : data.route === "Queenstown_to_KingPhalo" ? "Queenstown → King Phalo Airport" : "King Phalo Airport → Queenstown"}</p>
            <p><strong>Date:</strong> {format(data.date, "PPP")}</p>
            <p><strong>Time:</strong> {data.time}</p>
            <p><strong>Passengers:</strong> {data.passengers}</p>
            {paymentResult && (
              <p><strong>Total Paid:</strong> R{pricing.total.toFixed(2)}</p>
            )}
          </div>
          {(!paymentResult && data.route.includes("Queenstown")) ? (
            <p className="text-muted-foreground">We will notify {data.email} once the trip is confirmed.</p>
          ) : (
            <p className="text-muted-foreground">A confirmation email has been sent to {data.email}. We will contact you shortly with final details.</p>
          )}
          <Button asChild className="mt-4">
            <Link to="/">Return to Home</Link>
          </Button>
        </CardContent>
      </>
    );
  };

  return (
    <Card className="w-full shadow-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderSuccess()}
        </form>
      </Form>
    </Card>
  );
};

export default BookingForm;

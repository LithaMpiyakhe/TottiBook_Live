import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import AdminChangePinDialog from "@/components/AdminChangePinDialog";
import { Switch } from "@/components/ui/switch";
import { apiBase } from "@/lib/utils";

const ROUTES = [
  { id: "Mthatha_to_KingPhalo", label: "Mthatha → King Phalo" },
  { id: "KingPhalo_to_Mthatha", label: "King Phalo → Mthatha" },
  { id: "Queenstown_to_KingPhalo", label: "Queenstown → King Phalo" },
  { id: "KingPhalo_to_Queenstown", label: "King Phalo → Queenstown" },
];

const TIME_SLOTS: Record<string, string[]> = {
  Mthatha_to_KingPhalo: ["4:00 AM", "11:00 AM"],
  KingPhalo_to_Mthatha: ["7:30 AM", "2:30 PM"],
  Queenstown_to_KingPhalo: ["6:00 AM"],
  KingPhalo_to_Queenstown: ["3:00 PM"],
};

const Availability: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{date:string;route:string;time:string}[]>([]);
  const form = useForm<{ route: string }>({ defaultValues: { route: "Mthatha_to_KingPhalo" } });
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (new URLSearchParams(location.search).get("admin") === "1") return true;
    try { return localStorage.getItem("totti_admin") === "1"; } catch (_) { return false; }
  });

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const route = form.watch("route");
  const lastTap = useRef<{ date: string; ts: number } | null>(null);

  const refresh = async () => {
    const base = apiBase();
    const resp = await fetch(`${base}/api/calendar/blocked`);
    if (resp.ok) {
      const data = await resp.json();
      setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
      setBlockedSlots(Array.isArray(data.slots) ? data.slots : []);
    }
  };

  useEffect(() => { refresh(); }, []);

  const [loginOpen, setLoginOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState<boolean>(() => {
    try { return (localStorage.getItem('totti_admin_mode') || 'edit') === 'view'; } catch (_) { return false; }
  });
  const toggleMode = (v: boolean) => {
    setViewOnly(v);
    try { localStorage.setItem('totti_admin_mode', v ? 'view' : 'edit'); } catch (_) {}
  };
  const logoutAdmin = () => {
    try { localStorage.removeItem('totti_admin'); } catch (_) {}
    setIsAdmin(false);
  };

  const isDateBlocked = blockedDates.includes(dateStr);
  const slotBlocked = (time: string) => !!blockedSlots.find(s => s.date === dateStr && s.route === route && s.time === time);

  const blockDate = async () => { const base = apiBase(); await fetch(`${base}/api/calendar/block-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); await refresh(); };
  const unblockDate = async () => { const base = apiBase(); await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); await refresh(); };
  const toggleSlot = async (time: string, block: boolean) => {
    const base = apiBase();
    const ep = block ? `${base}/api/calendar/block-slot` : `${base}/api/calendar/unblock-slot`;
    await fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route, time }) });
    await refresh();
  };

  return (
    <div className="min-h-screen p-4 bg-primary flex flex-col items-center">
      <div className="w-full max-w-md pt-2 pb-2 flex items-center justify-between">
        <Link to="/" aria-label="Home" className="text-primary-foreground">
          <Home className="h-7 w-7 text-primary-foreground" />
        </Link>
        <div className="flex items-center justify-end gap-2">
        {!isAdmin ? (
          <Button size="sm" variant="outline" onClick={() => setLoginOpen(true)}>Admin Login</Button>
        ) : (
          <>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-primary-foreground">View Only</span>
              <Switch checked={viewOnly} onCheckedChange={toggleMode} />
            </div>
            <Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}>Change PIN</Button>
            <Button size="sm" variant="outline" onClick={logoutAdmin}>Logout Admin</Button>
          </>
        )}
        </div>
      </div>
      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => setIsAdmin(true)} showChangePin onOpenChangePin={() => setChangeOpen(true)} />
      <AdminChangePinDialog open={changeOpen} onOpenChange={setChangeOpen} />
      {isAdmin && (
      <div className="w-full max-w-md mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Availability Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <FormField name="route" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Route</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 gap-2">
                      {ROUTES.map(r => (
                        <div key={r.id} className="flex items-center space-x-3 border rounded-md p-3">
                          <RadioGroupItem value={r.id} />
                          <span>{r.label}</span>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
            </Form>

            <div className="space-y-2">
              <div className="font-medium">Select Date</div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                modifiers={{ blocked: blockedDates.map((d) => new Date(d + 'T00:00')) }}
                modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive" }}
                disabled={(date) => {
                  const today = new Date();
                  return date < today;
                }}
                onDayClick={async (d, modifiers) => {
                  if (!d) return;
                  const ymd = format(d, 'yyyy-MM-dd');
                  const now = Date.now();
                  const prev = lastTap.current;
                  if ((modifiers as any)?.blocked && prev && prev.date === ymd && now - prev.ts < 400) {
                    const base = apiBase();
                    await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: ymd }) });
                    await refresh();
                    lastTap.current = null;
                    return;
                  }
                  lastTap.current = { date: ymd, ts: now };
                }}
              />
              <div className="flex items-center gap-2">
                <Input type="date" value={dateStr} onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00'))} />
                {isDateBlocked ? (
                  <Button variant="outline" disabled={viewOnly} onClick={unblockDate}>Unblock Date</Button>
                ) : (
                  <Button variant="outline" disabled={viewOnly} onClick={blockDate}>Block Date</Button>
                )}
                <span className="text-xs px-2 py-1 rounded bg-secondary/50 border">{isDateBlocked ? 'Blocked' : 'Available'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="font-medium">Time Slots</div>
              <div className="space-y-2">
                {TIME_SLOTS[route].map((t) => (
                  <div key={t} className="flex items-center justify-between border rounded-md p-3 bg-secondary/30">
                    <div className="text-sm font-medium">{t}</div>
                    {slotBlocked(t) ? (
                      <Button size="sm" variant="secondary" disabled={viewOnly} onClick={() => toggleSlot(t, false)}>Unblock</Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={viewOnly} onClick={() => toggleSlot(t, true)}>Block</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Blocked Dates</div>
              <div className="space-y-2">
                {blockedDates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No blocked dates.</p>
                )}
                {blockedDates
                  .slice()
                  .sort()
                  .map((d) => (
                    <div key={d} className="flex items-center justify-between border rounded-md p-3 bg-secondary/30">
                      <div className="text-sm">{d}</div>
                      <Button size="sm" variant="outline" disabled={viewOnly} onClick={async () => { const base = apiBase(); await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: d }) }); await refresh(); }}>Unblock</Button>
                    </div>
                  ))}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
};

export default Availability;

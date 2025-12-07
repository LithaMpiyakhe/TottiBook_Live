import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import AdminChangePinDialog from "@/components/AdminChangePinDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

const Admin: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (new URLSearchParams(location.search).get("admin") === "1") return true;
    try { if (sessionStorage.getItem("totti_admin") === "1") return true; } catch (_) {}
    try { return localStorage.getItem("totti_admin") === "1"; } catch (_) { return false; }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState<boolean>(() => {
    try { return (localStorage.getItem('totti_admin_mode') || 'edit') === 'view'; } catch (_) { return false; }
  });
  const toggleMode = (v: boolean) => {
    setViewOnly(v);
    try { localStorage.setItem('totti_admin_mode', v ? 'view' : 'edit'); } catch (_) {}
  };

  const [date, setDate] = useState<Date>(new Date());
  const dateStr = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{date:string;route:string;time:string}[]>([]);
  const [requests, setRequests] = useState<{date:string; time:string; count:number; status:string}[]>([]);
  const [threshold, setThreshold] = useState<number>(0);
  const [icsEnabled, setIcsEnabled] = useState(false);
  const [graphEnabled, setGraphEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [section, setSection] = useState<'calendar'|'slots'|'requests'>('calendar');
  const [qtnEnabled, setQtnEnabled] = useState<boolean>(true);
  const [qtnRoutes, setQtnRoutes] = useState<{Queenstown_to_KingPhalo:boolean;KingPhalo_to_Queenstown:boolean}>({ Queenstown_to_KingPhalo: true, KingPhalo_to_Queenstown: true });
  const lastTap = useRef<{ date: string; ts: number } | null>(null);

  const form = useForm<{ route: string }>({ defaultValues: { route: "Queenstown_to_KingPhalo" } });
  const route = form.watch("route");

  const refreshBlocked = async () => {
    const base = apiBase();
    const resp = await fetch(`${base}/api/calendar/blocked`);
    if (resp.ok) {
      const data = await resp.json();
      setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
      setBlockedSlots(Array.isArray(data.slots) ? data.slots : []);
    }
  };
  const refreshRequests = async () => {
    const base = apiBase();
    const resp = await fetch(`${base}/api/queenstown/list?date=${dateStr}`);
    if (resp.ok) {
      const data = await resp.json();
      setRequests(data.requests || []);
      setThreshold(data.threshold || 0);
    }
  };
  useEffect(() => { if (isAdmin) { refreshBlocked(); refreshRequests(); } }, [isAdmin, dateStr]);
  useEffect(() => {
    (async () => {
      try {
        const base = apiBase();
        const r = await fetch(`${base}/api/admin/status`);
        if (r.ok) {
          const data = await r.json();
          if (!data.requiresPin) setIsAdmin(true);
        }
      } catch (_) {}
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const base = apiBase();
        const r = await fetch(`${base}/api/queenstown/config`);
        if (r.ok) {
          const data = await r.json();
          setQtnEnabled(!!data.enabled);
          if (data.routes) setQtnRoutes({
            Queenstown_to_KingPhalo: !!data.routes.Queenstown_to_KingPhalo,
            KingPhalo_to_Queenstown: !!data.routes.KingPhalo_to_Queenstown,
          });
        } else {
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
        }
      } catch (_) {}
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const base = apiBase();
        const r = await fetch(`${base}/api/health`);
        if (r.ok) {
          const data = await r.json();
          setIcsEnabled(!!data.icsPresent);
          setGraphEnabled(!!data.graphPresent);
        }
      } catch (_) {}
    })();
  }, []);

  const isDateBlocked = blockedDates.includes(dateStr);
  const slotBlocked = (time: string) => !!blockedSlots.find(s => s.date === dateStr && s.route === route && s.time === time);
  const blockDate = async () => { if (viewOnly) return; const base = apiBase(); await fetch(`${base}/api/calendar/block-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); await refreshBlocked(); };
  const unblockDate = async () => { if (viewOnly) return; const base = apiBase(); await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); await refreshBlocked(); };
  const toggleSlot = async (time: string, block: boolean) => {
    if (viewOnly) return;
    const base = apiBase();
    const ep = block ? `${base}/api/calendar/block-slot` : `${base}/api/calendar/unblock-slot`;
    await fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route, time }) });
    await refreshBlocked();
  };
  const confirm = async (d:string, t:string) => { if (viewOnly) return; const base = apiBase(); await fetch(`${base}/api/queenstown/confirm`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: d, time: t }) }); await refreshRequests(); };
  const decline = async (d:string, t:string) => { if (viewOnly) return; const base = apiBase(); await fetch(`${base}/api/queenstown/decline`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: d, time: t }) }); await refreshRequests(); };
  const syncCalendar = async () => {
    if (viewOnly) return;
    if (!icsEnabled && !graphEnabled) { setSyncMsg('Calendar sync unavailable'); return; }
    setSyncing(true);
    const toLabel = (hhmm:string) => {
      if (hhmm === '06:00') return '6:00 AM';
      if (hhmm === '15:00') return '3:00 PM';
      const [h,m] = hhmm.split(':').map(Number);
      const am = h < 12;
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
    };
    try {
      let total = 0;
      if (icsEnabled) {
        const base = apiBase();
        const resp = await fetch(`${base}/api/calendar/ics?start=${dateStr}&end=${dateStr}`);
        if (resp.ok) {
          const data = await resp.json();
          const times = Array.isArray(data.blockedTimes) ? data.blockedTimes : [];
          for (const t of times) {
            const label = toLabel(t);
            await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route: 'Queenstown_to_KingPhalo', time: label }) });
            await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route: 'KingPhalo_to_Queenstown', time: label }) });
          }
          total += times.length;
        }
      }
      if (graphEnabled) {
        const base = apiBase();
        const resp = await fetch(`${base}/api/graph/availability?start=${dateStr}&end=${dateStr}`);
        if (resp.ok) {
          const data = await resp.json();
          const times = Array.isArray(data.blockedTimes) ? data.blockedTimes : [];
          for (const t of times) {
            const label = toLabel(t);
            await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route: 'Queenstown_to_KingPhalo', time: label }) });
            await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr, route: 'KingPhalo_to_Queenstown', time: label }) });
          }
          total += times.length;
        }
      }
      setSyncMsg(total ? `Synced ${total} time(s)` : 'No events found');
      await refreshBlocked();
    } catch (_) {}
    setSyncing(false);
  };

  return (
    <div className="min-h-screen p-4 bg-primary flex flex-col items-center">
      <div className="w-full max-w-md pt-2 pb-2 flex items-center justify-between">
        <Link to="/" aria-label="Home" className="text-primary-foreground">
          <Home className="h-7 w-7 text-primary-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          {!isAdmin ? (
            <Button size="sm" variant="outline" onClick={() => setLoginOpen(true)}>Admin Login</Button>
          ) : (
            <>
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-primary-foreground">View Only</span>
                <Switch checked={viewOnly} onCheckedChange={toggleMode} />
              </div>
              <Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}>Change PIN</Button>
              <Button size="sm" variant="outline" onClick={() => { try { localStorage.removeItem('totti_admin'); sessionStorage.removeItem('totti_admin'); } catch (_) {} ; setIsAdmin(false); navigate('/'); }}>Logout</Button>
            </>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="w-full max-w-md mb-2">
          <Select value={section} onValueChange={(v) => setSection(v as any)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Show" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar">Date & Calendar</SelectItem>
              <SelectItem value="slots">Time Slots</SelectItem>
              <SelectItem value="requests">Requests</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-2 space-y-2 rounded-md border bg-secondary/30 px-3 py-2">
              <div className="flex items-center justify-between">
              <Label className="text-sm">Queenstown options</Label>
              <Switch checked={qtnEnabled} onCheckedChange={async (v) => { if (viewOnly) return; setQtnEnabled(v); try { const base = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, ''); await fetch(`${base}/api/queenstown/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled: v }) }); } catch (_) {} try { localStorage.setItem('totti_qtn_config', JSON.stringify({ enabled: v, routes: qtnRoutes })); } catch (_) {} try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('qtn-config-update')); } catch (_) {} }} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Queenstown → King Phalo</Label>
                <Switch disabled={!qtnEnabled} checked={qtnRoutes.Queenstown_to_KingPhalo} onCheckedChange={async (v) => { if (viewOnly || !qtnEnabled) return; const next = { ...qtnRoutes, Queenstown_to_KingPhalo: v }; setQtnRoutes(next); try { const base = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, ''); await fetch(`${base}/api/queenstown/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ routes: { Queenstown_to_KingPhalo: v } }) }); } catch (_) {} try { localStorage.setItem('totti_qtn_config', JSON.stringify({ enabled: qtnEnabled, routes: next })); } catch (_) {} try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('qtn-config-update')); } catch (_) {} }} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">King Phalo → Queenstown</Label>
                <Switch disabled={!qtnEnabled} checked={qtnRoutes.KingPhalo_to_Queenstown} onCheckedChange={async (v) => { if (viewOnly || !qtnEnabled) return; const next = { ...qtnRoutes, KingPhalo_to_Queenstown: v }; setQtnRoutes(next); try { const base = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, ''); await fetch(`${base}/api/queenstown/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ routes: { KingPhalo_to_Queenstown: v } }) }); } catch (_) {} try { localStorage.setItem('totti_qtn_config', JSON.stringify({ enabled: qtnEnabled, routes: next })); } catch (_) {} try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('qtn-config-update')); } catch (_) {} }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
      <div className="w-full max-w-md mx-auto grid gap-4">
        {section === 'calendar' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Date & Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && setDate(d)}
            initialFocus
              modifiers={{ blocked: blockedDates.map((d) => new Date(d + 'T00:00')) }}
              modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive" }}
              disabled={(d) => {
                const today = new Date();
                return d < today;
              }}
              onDayClick={async (d, modifiers) => {
                if (!d) return;
                const ymd = format(d, 'yyyy-MM-dd');
                const now = Date.now();
                const prev = lastTap.current;
                if ((modifiers as any)?.blocked && prev && prev.date === ymd && now - prev.ts < 400) {
                  if (!viewOnly) {
                    const base = apiBase();
                    await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: ymd }) });
                    await refreshBlocked();
                  }
                  lastTap.current = null;
                  return;
                }
                lastTap.current = { date: ymd, ts: now };
              }}
          />
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={dateStr} onChange={(e) => setDate(new Date(e.target.value + 'T00:00'))} />
              <span className="text-xs px-2 py-1 rounded bg-secondary/50 border">{isDateBlocked ? 'Blocked' : 'Available'}</span>
              {isDateBlocked ? (
                <Button variant="outline" disabled={viewOnly} onClick={unblockDate}>Unblock Date</Button>
              ) : (
                <Button variant="outline" disabled={viewOnly} onClick={blockDate}>Block Date</Button>
              )}
              <Button variant="secondary" disabled={viewOnly || (!icsEnabled && !graphEnabled) || syncing} onClick={syncCalendar}>Sync Calendar</Button>
              <Button variant="secondary" disabled={viewOnly || !graphEnabled || syncing} onClick={async () => { setSyncing(true); setSyncMsg(''); try { const base = apiBase(); const resp = await fetch(`${base}/api/graph/push-blocks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); if (resp.ok) { const d = await resp.json(); const n = Array.isArray(d.created) ? d.created.length : 0; setSyncMsg(n ? `Pushed ${n} event(s)` : 'No blocks to push'); } } catch (_) {} setSyncing(false); }}>Push to Outlook</Button>
              <Button variant="outline" disabled={viewOnly || !graphEnabled || syncing} onClick={async () => { setSyncing(true); setSyncMsg(''); try { const base = apiBase(); const resp = await fetch(`${base}/api/graph/remove-blocks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dateStr }) }); if (resp.ok) { const d = await resp.json(); const n = typeof d.removed === 'number' ? d.removed : 0; setSyncMsg(n ? `Removed ${n} event(s)` : 'No matching events found'); } } catch (_) {} setSyncing(false); }}>Remove from Outlook</Button>
            </div>
            <div className="w-full flex flex-col gap-1">
              {(viewOnly || (!icsEnabled && !graphEnabled) || syncing) && (
                <span className="text-xs text-muted-foreground">
                  {viewOnly ? 'Disabled in view-only mode' : (syncing ? 'Sync in progress' : (icsEnabled ? 'ICS configured' : (graphEnabled ? 'Graph configured' : 'Calendar sync unavailable')))}
                </span>
              )}
              {syncMsg && <span className="text-xs text-muted-foreground">{syncMsg}</span>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">Blocked Dates</div>
                {blockedDates.length > 0 && (
                  <Button size="sm" variant="outline" disabled={viewOnly} onClick={async () => { const base = apiBase(); await fetch(`${base}/api/calendar/unblock-all`, { method:'POST' }); await refreshBlocked(); }}>Unblock All</Button>
                )}
              </div>
              {blockedDates.length === 0 && (
                <p className="text-sm text-muted-foreground">No blocked dates.</p>
              )}
              {blockedDates.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {Array.from(new Map(blockedDates.map((d) => [format(parseISO(d), 'MMMM yyyy'), d])).keys()).map((label) => {
                    const dates = blockedDates.filter((x) => format(parseISO(x), 'MMMM yyyy') === label).sort();
                    return (
                      <div key={label} className="border rounded-md p-3 bg-secondary/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{label}</div>
                          <Button size="sm" variant="outline" disabled={viewOnly} onClick={async () => { const base = apiBase(); await Promise.all(dates.map((dd) => fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dd }) }))); await refreshBlocked(); }}>Unblock Month</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {dates.map((dd) => (
                            <div key={dd} className="flex items-center justify-between border rounded-md p-2">
                              <div className="text-xs">{dd}</div>
                              <Button size="sm" variant="outline" disabled={viewOnly} onClick={async () => { const base = apiBase(); await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: dd }) }); await refreshBlocked(); }}>Unblock</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {section === 'slots' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time Slots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
        )}

        {section === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queenstown Requests (Threshold: {threshold})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input type="date" value={dateStr} onChange={(e) => setDate(new Date(e.target.value))} />
            </div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {requests.length === 0 && (
                <p className="text-sm text-muted-foreground">No requests for selected date.</p>
              )}
              {requests.map((r) => (
                <div key={`${r.date}-${r.time}`} className="flex items-center justify-between border rounded-md p-3 bg-secondary/30">
                  <div>
                    <div className="text-sm font-medium">{r.time}</div>
                    <div className="text-xs text-muted-foreground">{r.count} seats • {r.status}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={viewOnly} onClick={() => confirm(r.date, r.time)}>Confirm</Button>
                    <Button size="sm" variant="destructive" disabled={viewOnly} onClick={() => decline(r.date, r.time)}>Decline</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      )}

      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => setIsAdmin(true)} showChangePin onOpenChangePin={() => setChangeOpen(true)} />
      <AdminChangePinDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
};

export default Admin;

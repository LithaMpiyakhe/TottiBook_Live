import React, { useEffect, useState } from "react";
import BookingForm from "@/components/BookingForm";
import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import AdminChangePinDialog from "@/components/AdminChangePinDialog";
import { Switch } from "@/components/ui/switch";
import { apiBase } from "@/lib/utils";

const Booking: React.FC = () => {
  const location = useLocation();
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
  const [adminDate, setAdminDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [requests, setRequests] = useState<{date:string; time:string; count:number; status:string}[]>([]);
  const [threshold, setThreshold] = useState<number>(0);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const base = apiBase();

  const refreshBlockedDates = async () => {
    try {
      const resp = await fetch(`${base}/api/calendar/blocked`);
      if (resp.ok) {
        const data = await resp.json();
        setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const resp = await fetch(`${base}/api/queenstown/list?date=${adminDate}`);
        if (resp.ok) {
          const data = await resp.json();
          setRequests(data.requests || []);
          setThreshold(data.threshold || 0);
        }
      } catch (_) {}
    })();
  }, [isAdmin, adminDate]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const resp = await fetch(`${base}/api/calendar/blocked`);
        if (resp.ok) {
          const data = await resp.json();
          setBlockedDates(Array.isArray(data.blocked) ? data.blocked : []);
        }
      } catch (_) {}
    })();
  }, [isAdmin, adminDate]);

  const loginAdmin = async () => {
    const pin = typeof window !== 'undefined' ? window.prompt('Enter admin PIN') : '';
    if (!pin) return;
    try {
      const resp = await fetch(`${base}/api/admin/verify`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin }) });
      if (resp.ok) {
        try { localStorage.setItem('totti_admin','1'); } catch (_) {}
        setIsAdmin(true);
      }
    } catch (_) {}
  };
  const logoutAdmin = () => {
    try { localStorage.removeItem('totti_admin'); sessionStorage.removeItem('totti_admin'); } catch (_) {}
    setIsAdmin(false);
  };

  const confirm = async (date:string, time:string) => {
    await fetch(`${base}/api/queenstown/confirm`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date, time }) });
    const resp = await fetch(`${base}/api/queenstown/list?date=${adminDate}`);
    if (resp.ok) { const data = await resp.json(); setRequests(data.requests || []); }
  };
  const decline = async (date:string, time:string) => {
    await fetch(`${base}/api/queenstown/decline`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date, time }) });
    const resp = await fetch(`${base}/api/queenstown/list?date=${adminDate}`);
    if (resp.ok) { const data = await resp.json(); setRequests(data.requests || []); }
  };
  return (
    <div className="min-h-screen p-4 bg-primary flex flex-col items-center">
      
      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => setIsAdmin(true)} showChangePin onOpenChangePin={() => setChangeOpen(true)} />
      <AdminChangePinDialog open={changeOpen} onOpenChange={setChangeOpen} />
      {isAdmin && (
        <div className="w-full max-w-md mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Queenstown Requests (Threshold: {threshold})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input type="date" value={adminDate} onChange={(e) => setAdminDate(e.target.value)} />
                <span className="text-xs px-2 py-1 rounded bg-secondary/50 border">{blockedDates.includes(adminDate) ? 'Blocked' : 'Available'}</span>
                <Button variant="outline" onClick={async () => {
                  try {
                    const r = await fetch(`${base}/api/calendar/block-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adminDate }) });
                    if (r.ok) {
                      if (typeof window !== 'undefined') window.dispatchEvent(new Event('blocked-update'));
                      await refreshBlockedDates();
                    }
                  } catch (_) {}
                }}>Block Date</Button>
                <Button variant="outline" onClick={async () => {
                  try {
                    const r = await fetch(`${base}/api/calendar/unblock-date`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adminDate }) });
                    if (r.ok) {
                      if (typeof window !== 'undefined') window.dispatchEvent(new Event('blocked-update'));
                      await refreshBlockedDates();
                    }
                  } catch (_) {}
                }}>Unblock Date</Button>
                <Button variant="secondary" disabled={viewOnly} onClick={async () => {
                  const toLabel = (hhmm:string) => {
                    if (hhmm === '06:00') return '6:00 AM';
                    if (hhmm === '15:00') return '3:00 PM';
                    const [h,m] = hhmm.split(':').map(Number);
                    const am = h < 12;
                    const hour12 = h % 12 || 12;
                    return `${hour12}:${String(m).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
                  };
                  const applyTimes = async (times:string[]) => {
                    await Promise.all(times.map(async (t:string) => {
                      const label = toLabel(t);
                      await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adminDate, route: 'Queenstown_to_KingPhalo', time: label }) });
                      await fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: adminDate, route: 'KingPhalo_to_Queenstown', time: label }) });
                    }));
                    const refresh = await fetch(`${base}/api/queenstown/list?date=${adminDate}`);
                    if (refresh.ok) { const d = await refresh.json(); setRequests(d.requests || []); setThreshold(d.threshold || 0); }
                  };
                  try {
                    let resp = await fetch(`${base}/api/calendar/ics?start=${adminDate}&end=${adminDate}`);
                    if (resp.ok) {
                      const data = await resp.json();
                      const times = Array.isArray(data.blockedTimes) ? data.blockedTimes : [];
                      if (times.length) return applyTimes(times);
                    }
                    resp = await fetch(`${base}/api/graph/availability?start=${adminDate}&end=${adminDate}`);
                    if (resp.ok) {
                      const data = await resp.json();
                      const times = Array.isArray(data.blockedTimes) ? data.blockedTimes : [];
                      if (times.length) return applyTimes(times);
                    }
                  } catch (_) {}
                }}>Sync Calendar</Button>
              </div>
              <div className="space-y-2">
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
                      <Button size="sm" variant="secondary" disabled={viewOnly} onClick={() => fetch(`${base}/api/calendar/block-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: r.date, route: 'Queenstown_to_KingPhalo', time: r.time }) })}>Block</Button>
                      <Button size="sm" variant="secondary" disabled={viewOnly} onClick={() => fetch(`${base}/api/calendar/unblock-slot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date: r.date, route: 'Queenstown_to_KingPhalo', time: r.time }) })}>Unblock</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="w-full max-w-md pt-8 pb-4 flex items-center justify-between">
        <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary/80">
          <Link to="/" className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Links</span>
          </Link>
        </Button>
        <img
          src="/totti-logo.png"
          alt="Totti Shuttle and Charter Logo"
          className="h-10 w-auto"
        />
      </div>
      <div className="w-full max-w-md flex-grow">
        <BookingForm />
      </div>
    </div>
  );
};
      
export default Booking;

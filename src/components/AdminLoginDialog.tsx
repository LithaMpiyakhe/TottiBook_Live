import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiBase } from "@/lib/utils";

interface AdminLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showChangePin?: boolean;
  onOpenChangePin?: () => void;
}

const AdminLoginDialog: React.FC<AdminLoginDialogProps> = ({ open, onOpenChange, onSuccess, showChangePin = false, onOpenChangePin }) => {
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requiresPin, setRequiresPin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = apiBase();
        const r = await fetch(`${base}/api/admin/status`);
        if (r.ok) {
          const data = await r.json();
          setRequiresPin(!!data.requiresPin);
        }
      } catch (_) {}
    })();
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const base = apiBase();
      const resp = await fetch(`${base}/api/admin/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      if (resp.ok) {
        try {
          if (remember) {
            localStorage.setItem('totti_admin', '1');
          } else {
            sessionStorage.setItem('totti_admin', '1');
          }
        } catch (_) {}
        onSuccess();
        onOpenChange(false);
        return;
      }
      setError('Invalid PIN');
    } catch (_) {
      setError('Unable to verify PIN');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Login</DialogTitle>
          <DialogDescription>
            {requiresPin === false ? "No PIN set. Login or set a PIN." : "Enter the admin PIN to manage availability."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="password" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Remember on this device</span>
            <Switch checked={remember} onCheckedChange={setRemember} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          {showChangePin && (
            <Button variant="link" onClick={onOpenChangePin} disabled={submitting}>Change PIN</Button>
          )}
          <Button onClick={submit} disabled={submitting}>Login</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoginDialog;

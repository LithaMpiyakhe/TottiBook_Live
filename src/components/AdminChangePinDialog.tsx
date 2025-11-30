import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AdminChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminChangePinDialog: React.FC<AdminChangePinDialogProps> = ({ open, onOpenChange }) => {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [requiresPin, setRequiresPin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch('/api/admin/status');
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
    setSuccess(false);
    if (newPin !== confirmPin) { setError('PINs do not match'); setSubmitting(false); return; }
    try {
      const resp = await fetch('/api/admin/change-pin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ current: currentPin, next: newPin }) });
      if (resp.ok) {
        setSuccess(true);
        setTimeout(() => onOpenChange(false), 800);
        return;
      }
      setError('Invalid current PIN');
    } catch (_) {
      setError('Unable to change PIN');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Admin PIN</DialogTitle>
          <DialogDescription>{requiresPin === false ? 'No current PIN set. Enter a new PIN.' : 'Enter current and new PIN to update access.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="password" placeholder={requiresPin === false ? 'Current PIN (empty)' : 'Current PIN'} value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
          <Input type="password" placeholder="New PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
          <Input type="password" placeholder="Confirm New PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">PIN updated</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !newPin || !confirmPin || (!!requiresPin && !currentPin)}>Update PIN</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminChangePinDialog;

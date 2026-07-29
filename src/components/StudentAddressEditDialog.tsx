'use client';

import { useEffect, useState } from 'react';
import { ClipboardPaste, Loader2, MapPin } from 'lucide-react';
import { parsePastedAddress } from '@/lib/addressValidation';
import { formatFullName } from '@/lib/personName';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface StudentAddressRecord {
  _id: string;
  labelId?: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressValidationStatus?: string;
}

interface StudentAddressEditDialogProps {
  student: StudentAddressRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function StudentAddressEditDialog({
  student,
  open,
  onOpenChange,
  onSaved,
}: StudentAddressEditDialogProps) {
  const [address, setAddress] = useState('');
  const [apt, setApt] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('NY');
  const [zip, setZip] = useState('');
  const [verifyAfterSave, setVerifyAfterSave] = useState(true);
  const [pasteValue, setPasteValue] = useState('');
  const [parseMessage, setParseMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!student || !open) return;
    setAddress(student.address || '');
    setApt(student.apt || '');
    setCity(student.city || '');
    setState(student.state || 'NY');
    setZip(student.zip || '');
    setVerifyAfterSave(true);
    setPasteValue('');
    setParseMessage('');
    setError('');
  }, [student, open]);

  function handleParsePasted() {
    setParseMessage('');
    const parsed = parsePastedAddress(pasteValue);
    if (!parsed) {
      setParseMessage('Could not parse. Try: 1281 Sterling Pl, Brooklyn, NY 11213');
      return;
    }
    setAddress(parsed.address || '');
    setApt(parsed.apt || '');
    setCity(parsed.city || '');
    setState(parsed.state || 'NY');
    setZip(parsed.zip || '');
    setParseMessage('Address parsed — review the fields below, then save.');
  }

  async function handleSave() {
    if (!student) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/students/${student._id}/address`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          apt,
          city,
          state,
          zip,
          verifyAfterSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save address');

      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save address');
    } finally {
      setSaving(false);
    }
  }

  const displayName = student ? formatFullName(student) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Edit address
          </DialogTitle>
          <DialogDescription>
            {displayName || 'Student'}
            {student?.labelId ? ` · ${student.labelId}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5 rounded-md border border-dashed p-3 bg-muted/30">
            <Label htmlFor="paste-address" className="text-xs text-muted-foreground">
              Paste full address (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="paste-address"
                value={pasteValue}
                onChange={e => setPasteValue(e.target.value)}
                placeholder="1281 Sterling Pl, Apt 4B, Brooklyn, NY 11213"
                className="text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                onClick={handleParsePasted}
                disabled={!pasteValue.trim()}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Parse
              </Button>
            </div>
            {parseMessage && (
              <p className={`text-xs ${parseMessage.startsWith('Could') ? 'text-amber-700' : 'text-green-700'}`}>
                {parseMessage}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-address">Street address</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="690 Grand St"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-apt">Apt / Unit</Label>
            <Input
              id="edit-apt"
              value={apt}
              onChange={e => setApt(e.target.value)}
              placeholder="4B, 2, #5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">City / Borough</Label>
              <Input
                id="edit-city"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Brooklyn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="NY"
                maxLength={2}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-zip">ZIP</Label>
            <Input
              id="edit-zip"
              value={zip}
              onChange={e => setZip(e.target.value)}
              placeholder="11211"
              maxLength={10}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="verify-after-save"
              checked={verifyAfterSave}
              onCheckedChange={v => setVerifyAfterSave(Boolean(v))}
            />
            <Label htmlFor="verify-after-save" className="text-sm font-normal cursor-pointer">
              Verify with NYC Geoclient after saving
            </Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save address'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

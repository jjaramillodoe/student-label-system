'use client';

import { useState } from 'react';
import {
  AlertTriangle, ClipboardPaste, ExternalLink, Loader2, MapPin,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatStudentAddressStacked,
  parsePastedAddress,
} from '@/lib/addressValidation';
import { googleMapsSearchUrl } from '@/lib/googleMaps';

export type IntakeAddressValues = {
  address: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
};

export type IntakeAddressVerification = {
  status: string;
  warnings: string[];
  geoclient?: { latitude?: number; longitude?: number };
  standardized?: IntakeAddressValues;
};

interface IntakeAddressFieldsProps {
  values: IntakeAddressValues;
  onChange: (values: IntakeAddressValues) => void;
  verification: IntakeAddressVerification | null;
  onVerificationChange: (v: IntakeAddressVerification | null) => void;
  geoclientConfigured: boolean | null;
  /** When true, show saved address only — no edit or verify controls */
  readOnly?: boolean;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    verified: 'bg-green-100 text-green-700 border-green-300',
    warning: 'bg-amber-100 text-amber-700 border-amber-300',
    not_found: 'bg-red-100 text-red-700 border-red-300',
    unverified: 'bg-slate-100 text-slate-600 border-slate-300',
    error: 'bg-red-100 text-red-700 border-red-300',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <Badge variant="outline" className={`text-xs capitalize ${map[status] || ''}`}>
      {label}
    </Badge>
  );
}

export default function IntakeAddressFields({
  values,
  onChange,
  verification,
  onVerificationChange,
  geoclientConfigured,
  readOnly = false,
}: IntakeAddressFieldsProps) {
  const [pasteValue, setPasteValue] = useState('');
  const [parseMessage, setParseMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [enteredBeforeVerify, setEnteredBeforeVerify] = useState<IntakeAddressValues | null>(null);

  function setField(key: keyof IntakeAddressValues, value: string) {
    onChange({ ...values, [key]: value } as IntakeAddressValues);
    onVerificationChange(null);
    setEnteredBeforeVerify(null);
  }

  function handleParse() {
    setParseMessage('');
    const parsed = parsePastedAddress(pasteValue);
    if (!parsed) {
      setParseMessage('Could not parse. Try: 1281 Sterling Pl, Brooklyn, NY 11213');
      return;
    }
    onChange({
      address: parsed.address || '',
      apt: parsed.apt || '',
      city: parsed.city || '',
      state: parsed.state || 'NY',
      zip: parsed.zip || '',
    });
    onVerificationChange(null);
    setEnteredBeforeVerify(null);
    setParseMessage('Address parsed — verify with Geoclient before submitting.');
  }

  async function handleVerify() {
    if (!values.address.trim()) {
      setVerifyError('Enter a street address first.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    setEnteredBeforeVerify({ ...values });
    try {
      const res = await fetch('/api/admin/addresses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          rows: [{ index: 0, ...values }],
          limit: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      const result = data.results?.[0];
      if (!result) throw new Error('No verification result returned.');

      const next: IntakeAddressVerification = {
        status: result.status,
        warnings: result.warnings || [],
        geoclient: result.geoclient,
        standardized: result.standardized,
      };
      onVerificationChange(next);

      if (result.standardized && ['verified', 'warning'].includes(result.status)) {
        onChange({
          address: result.standardized.address || values.address,
          apt: result.standardized.apt || values.apt,
          city: result.standardized.city || values.city,
          state: result.standardized.state || values.state,
          zip: result.standardized.zip || values.zip,
        });
      }
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed');
      onVerificationChange(null);
      setEnteredBeforeVerify(null);
    } finally {
      setVerifying(false);
    }
  }

  const displayValues = verification?.standardized
    ? { ...values, ...verification.standardized }
    : values;
  const stacked = formatStudentAddressStacked(displayValues);
  const enteredStacked = enteredBeforeVerify
    ? formatStudentAddressStacked(enteredBeforeVerify)
    : null;
  const showStandardizedPreview = Boolean(
    verification
    && stacked?.streetLine
    && ['verified', 'warning'].includes(verification.status),
  );
  const mapsUrl = googleMapsSearchUrl({
    latitude: verification?.geoclient?.latitude,
    longitude: verification?.geoclient?.longitude,
    address: stacked?.streetLine || displayValues.address,
    city: displayValues.city,
    state: displayValues.state,
    zip: displayValues.zip,
  });

  const inputClass = readOnly ? 'bg-muted/50 cursor-default' : undefined;

  if (readOnly && !values.address.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">No address on file.</p>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
      <div className="space-y-1.5 rounded-md border border-dashed p-3 bg-muted/20">
        <Label className="text-xs text-muted-foreground">Paste full address (optional)</Label>
        <div className="flex gap-2">
          <Input
            value={pasteValue}
            onChange={e => setPasteValue(e.target.value)}
            placeholder="1281 Sterling Pl, Brooklyn, NY 11213"
            className="text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1"
            onClick={handleParse}
            disabled={!pasteValue.trim()}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Parse
          </Button>
        </div>
        {parseMessage ? (
          <p className={`text-xs ${parseMessage.startsWith('Could') ? 'text-amber-700' : 'text-green-700'}`}>
            {parseMessage}
          </p>
        ) : null}
      </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="intake-address">Street address</Label>
          <Input
            id="intake-address"
            value={values.address}
            onChange={e => setField('address', e.target.value)}
            placeholder="1281 Sterling Pl"
            readOnly={readOnly}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-apt">Apt / Unit</Label>
          <Input
            id="intake-apt"
            value={values.apt}
            onChange={e => setField('apt', e.target.value)}
            placeholder="4B, 2, #5"
            readOnly={readOnly}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-city">City / Borough</Label>
          <Input
            id="intake-city"
            value={values.city}
            onChange={e => setField('city', e.target.value)}
            placeholder="Brooklyn"
            readOnly={readOnly}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-state">State</Label>
          <Input
            id="intake-state"
            value={values.state}
            onChange={e => setField('state', e.target.value)}
            placeholder="NY"
            maxLength={2}
            readOnly={readOnly}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-zip">ZIP</Label>
          <Input
            id="intake-zip"
            value={values.zip}
            onChange={e => setField('zip', e.target.value)}
            placeholder="11213"
            maxLength={10}
            readOnly={readOnly}
            className={inputClass}
          />
        </div>
      </div>

      {readOnly && verification ? (
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(verification.status)}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on Google Maps
            </a>
          ) : null}
        </div>
      ) : null}

      {!readOnly && geoclientConfigured === false && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription className="text-xs">
            NYC Geoclient is not configured — address will be saved but not verified.
          </AlertDescription>
        </Alert>
      )}

      {!readOnly && geoclientConfigured && values.address.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</>
              : <><MapPin className="h-3.5 w-3.5" /> Verify with NYC Geoclient</>}
          </Button>
          {verification ? statusBadge(verification.status) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on Google Maps
            </a>
          ) : null}
        </div>
      )}

      {verification?.warnings?.length ? (
        <Alert className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-xs space-y-2">
            <p className="text-amber-800 dark:text-amber-200 font-medium">
              {verification.warnings[0]}
            </p>
            {showStandardizedPreview && (
              <div className="space-y-2 pt-1 border-t border-amber-200/80 dark:border-amber-800/80">
                {enteredStacked?.streetLine && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-amber-700/80 font-semibold mb-0.5">
                      You entered
                    </p>
                    <p className="text-amber-900 dark:text-amber-100">
                      {enteredStacked.streetLine}
                      {enteredStacked.cityStateZip ? (
                        <span className="text-amber-700 dark:text-amber-300"> · {enteredStacked.cityStateZip}</span>
                      ) : null}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-amber-700/80 font-semibold mb-0.5">
                    Standardized address (will be saved)
                  </p>
                  <p className="font-medium text-amber-950 dark:text-amber-50">
                    {stacked!.streetLine}
                    {stacked!.cityStateZip ? (
                      <span className="font-normal text-amber-800 dark:text-amber-200"> · {stacked!.cityStateZip}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {verifyError && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{verifyError}</AlertDescription>
        </Alert>
      )}

      {showStandardizedPreview && verification?.status === 'verified' && !verification.warnings?.length && (
        <Alert className="border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-800">
          <AlertDescription className="text-xs space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-green-700/80 font-semibold">
              Standardized address (will be saved)
            </p>
            <p className="font-medium text-green-900 dark:text-green-100">
              {stacked!.streetLine}
              {stacked!.cityStateZip ? (
                <span className="font-normal text-green-800 dark:text-green-200"> · {stacked!.cityStateZip}</span>
              ) : null}
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

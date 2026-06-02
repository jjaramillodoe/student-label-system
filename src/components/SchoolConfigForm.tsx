'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getFiscalYearOptions } from '@/lib/fiscalYear';

export type SchoolFormState = {
  name: string;
  type: string;
  active: boolean;
  agencyId: string;
  currentFiscalYear: string;
  intakeSessions: string[];
  intakeActivities: string[];
};

const FISCAL_YEAR_OPTIONS = getFiscalYearOptions();

const textareaClassName =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[160px] resize-y font-mono';

type SchoolConfigFormProps = {
  form: SchoolFormState;
  setForm: React.Dispatch<React.SetStateAction<SchoolFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  isDataLead: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
};

export default function SchoolConfigForm({
  form,
  setForm,
  onSubmit,
  saving,
  isDataLead,
  mode,
  onCancel,
}: SchoolConfigFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {isDataLead ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">{form.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            School name and other settings can only be changed by an administrator.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Basic details</h2>
            <p className="text-sm text-muted-foreground">
              How this school or program appears in dropdowns across the app.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="schoolName">Name</Label>
              <Input
                id="schoolName"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="District 79, School 8, Program Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencyId">
                Agency ID
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  (used in student IDs, e.g. R01)
                </span>
              </Label>
              <Input
                id="agencyId"
                value={form.agencyId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agencyId: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="R01"
                maxLength={8}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-derive from school name (School 1 → R01, School 2 → R02 …)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="District">District</SelectItem>
                  <SelectItem value="School">School</SelectItem>
                  <SelectItem value="Program">Program</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Checkbox
                id="active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, active: checked === true }))
                }
              />
              <Label htmlFor="active">Active in dropdowns</Label>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Intake form settings</h2>
          <p className="text-sm text-muted-foreground">
            Fiscal year, session times, and activity checkboxes shown on the intake form.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentFiscalYear">
            Current Fiscal Year
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              (used on the intake form)
            </span>
          </Label>
          <Select
            value={form.currentFiscalYear}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, currentFiscalYear: value }))
            }
          >
            <SelectTrigger id="currentFiscalYear" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FISCAL_YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Intake Sessions
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                (one per line)
              </span>
            </Label>
            <textarea
              className={textareaClassName}
              placeholder={'MORNING 8am-4pm\nEVENING 4pm-5pm\nSATURDAY'}
              value={(form.intakeSessions ?? []).join('\n')}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  intakeSessions: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use system defaults (MORNING 8am-4pm, EVENING 4pm-5pm, SATURDAY,
              MS265, SSHS, BUSHWICK-EVENING, RIDGEWOOD).
            </p>
          </div>
          <div className="space-y-2">
            <Label>
              Intake Activities
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                (one per line — checkbox options)
              </span>
            </Label>
            <textarea
              className={textareaClassName}
              placeholder={
                'Intake Paperwork Only\nOrientation\nTesting\nLocator\nPlacement\nAdditional Classes\nTransfer'
              }
              value={(form.intakeActivities ?? []).join('\n')}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  intakeActivities: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use system defaults (Intake Paperwork Only, Orientation, Testing,
              Locator, Placement, Additional Classes, Transfer).
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import {
  EMPLOYMENT_STATUS_OPTIONS,
  HISPANIC_LATINO_OPTIONS,
  INTAKE_BARRIERS,
  RACE_IDENTITY_OPTIONS,
  type BarrierKey,
} from '@/lib/intakeDemographics';
import type { IntakeFieldSetter, IntakeFormState } from '@/lib/intakeForm';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Globe2, ShieldAlert } from 'lucide-react';

type Props = {
  form: IntakeFormState;
  setField: IntakeFieldSetter;
};

export default function IntakeDemographicsCard({ form, setField }: Props) {
  function toggleRace(value: string) {
    const selected = form.raceIdentities.includes(value)
      ? form.raceIdentities.filter((v) => v !== value)
      : [...form.raceIdentities, value];
    setField('raceIdentities', selected);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4" /> Employment Status <span className="text-destructive">*</span>
          </CardTitle>
          <CardDescription className="text-xs">Choose one. Self-reported by the student.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <input
                  type="radio"
                  name="employmentStatus"
                  value={opt.value}
                  checked={form.employmentStatus === opt.value}
                  onChange={() => setField('employmentStatus', opt.value)}
                  className="accent-primary"
                  required
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4" /> Race &amp; Ethnicity Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Part 1 — Hispanic / Latino origin <span className="text-destructive">*</span>
            </legend>
            <p className="text-xs text-muted-foreground">Choose one.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {HISPANIC_LATINO_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-3 py-2.5 hover:bg-accent transition-colors"
                >
                  <input
                    type="radio"
                    name="hispanicLatinoOrigin"
                    value={opt.value}
                    checked={form.hispanicLatinoOrigin === opt.value}
                    onChange={() => setField('hispanicLatinoOrigin', opt.value)}
                    className="accent-primary"
                    required
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Part 2 — Race / identity <span className="text-destructive">*</span>
            </legend>
            <p className="text-xs text-muted-foreground">Choose all that apply. At least one is required.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RACE_IDENTITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-3 py-2.5 hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={form.raceIdentities.includes(opt.value)}
                    onCheckedChange={() => toggleRace(opt.value)}
                    id={`race-${opt.value}`}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" /> Barriers to Learning / Employment
            <span className="text-destructive">*</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Self-reported by the student. Every item needs Yes (Y) or No (N).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {INTAKE_BARRIERS.map((barrier) => {
              const value = form[barrier.key as BarrierKey];
              return (
                <div
                  key={barrier.key}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <Label htmlFor={`${barrier.key}-Y`} className="text-sm font-normal leading-snug pr-2">
                    {barrier.label}
                  </Label>
                  <div className="flex shrink-0 gap-3">
                    {(['Y', 'N'] as const).map((answer) => (
                      <label
                        key={answer}
                        className="flex items-center gap-1.5 cursor-pointer select-none text-sm font-medium"
                      >
                        <input
                          id={answer === 'Y' ? `${barrier.key}-Y` : `${barrier.key}-N`}
                          type="radio"
                          name={barrier.key}
                          value={answer}
                          checked={value === answer}
                          onChange={() => setField(barrier.key, answer)}
                          className="accent-primary"
                          required
                        />
                        {answer}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

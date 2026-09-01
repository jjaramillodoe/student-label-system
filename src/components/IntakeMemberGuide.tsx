'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, ChevronDown, Clock, Languages, Printer, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function IntakeMemberGuide() {
  const GUIDE_SEEN_KEY = 'intake-member-guide-seen';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(GUIDE_SEEN_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function markSeen() {
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      // ignore storage failures
    }
  }

  function toggleOpen() {
    // # 1. if the guide is open, close it and mark it as seen
    // When the app starts, can we keep it closed by default?
    if (open) {
      markSeen();
      setOpen(false);
      return;
    }
    else {
      setOpen(true);
    }
  }

  function printGuide() {
    setOpen(true);
    // Let the guide expand before the print dialog opens
    window.setTimeout(() => window.print(), 150);
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02] intake-member-guide-card shadow-sm rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={toggleOpen}
            className="flex-1 flex items-start gap-3 text-left min-w-0"
          >
            <div className="ui-icon-mark h-9 w-9 rounded-lg shrink-0">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2 tracking-tight">
                Intake member guide
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform print:hidden ${open ? 'rotate-180' : ''}`} />
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Step-by-step: how to register new students, log returning visits, and what to check before you submit.
              </CardDescription>
            </div>
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 print:hidden"
            onClick={printGuide}
            title="Print or save as PDF for desk reference"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print / PDF</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent
          id="intake-member-guide-print"
          className={`pt-0 space-y-5 text-sm ${open ? '' : 'hidden print:block'}`}
        >
          <div className="rounded-md border border-border bg-muted/40 px-3 py-3 space-y-2">
            <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              Tip: use Translate when the student needs another language
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground leading-relaxed">
              <li>
                Look at the top-right of this page for the <strong>Translate</strong> dropdown
                (language icon).
              </li>
              <li>
                Choose the student&apos;s language (Spanish, Chinese, Arabic, French, and many more).
                The intake form text switches so they can follow along on screen.
              </li>
              <li>
                Turn the screen toward the student while you ask questions — they can read labels
                and options in their language.
              </li>
              <li>
                When finished, set Translate back to <strong>English</strong> (or select the original
                language) before the next student so staff instructions stay clear for you.
              </li>
            </ol>
            <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
              You still enter names and answers in English as the student tells you — Translate
              helps them understand the form; it does not replace interpretation for complex cases.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                New First Time Student
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                <li>Select <strong className="text-foreground">NEW First-time student</strong> under Student Status.</li>
                <li>Complete the required <strong className="text-foreground">Check ASISTS</strong> step — search by name, DOB, or both in one box (ASISTS / legacy roster and this system, including archived).</li>
                <li>If a match appears, confirm whether it is <strong className="text-foreground">the student sitting with you</strong>. Live/archived matches use <strong className="text-foreground">Same person — log returning</strong>. ASISTS-only matches can continue as NEW to create a file in this system.</li>
                <li>If no match, check <strong className="text-foreground">“I checked ASISTS — student was not found”</strong> before personal info unlocks.</li>
                <li>Enter remaining personal info. Names use <strong className="text-foreground">A–Z letters, spaces, and hyphens only</strong>. Watch any later duplicate alert (including address).</li>
                <li>Add <strong className="text-foreground">phone, email, and home address</strong>. Click <strong className="text-foreground">Verify with NYC Geoclient</strong> so the standardized address is saved.</li>
                <li>Only check <strong className="text-foreground">“This is a different person”</strong> for a true sibling or coincidence — that flags the record for Data Lead review.</li>
                <li>Complete <strong className="text-foreground">BE or ESL</strong>, intake activity, placement class, session, and <strong className="text-foreground">Time In</strong> (defaults to now).</li>
                <li>Choose <strong className="text-foreground">Staying</strong> if another staff member will continue intake, or <strong className="text-foreground">Leaving</strong> with Time Out when the student is departing. They may return later the same day — log a new visit.</li>
                <li>Click <strong className="text-foreground">Register Student</strong> and review the success summary. Labels are printed later from the Dashboard via <strong className="text-foreground">Download Word Doc</strong> (Letter, 100%).</li>
              </ol>
            </div>
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Returning Student (another visit)
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                <li>Select <strong className="text-foreground">RETURNING</strong> under Student Status.</li>
                <li>Search by name, label ID, or DOB and select the student. Prior visits appear in the accordion — expand to review history.</li>
                <li>Personal info and address are <strong className="text-foreground">locked</strong> from the student record. Complete <strong className="text-foreground">today&apos;s visit</strong> fields fresh (BE/ESL, activity, session, time).</li>
                <li>File assignment keeps the existing cabinet/drawer unless the student needs a new drawer for the school year.</li>
                <li>Click <strong className="text-foreground">Log Visit &amp; Save</strong> — this adds a new visit without overwriting past visits.</li>
              </ol>
            </div>
          </div>
          <div className="rounded-md border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60 px-3 py-3 space-y-2">
            <p className="font-semibold text-xs text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Before you submit — quick checklist
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800/90 dark:text-amber-200/90">
              <li>✓ Duplicate alert reviewed (name + DOB + address)</li>
              <li>✓ DOB validated (16+; BE/ESL age 21 or within 6 weeks)</li>
              <li>✓ Address verified with Geoclient (new students)</li>
              <li>✓ Time In correct; Time Out if student is leaving</li>
              <li>✓ Handoff visits marked <strong>Staying</strong>; Leaving + Time Out if they depart (same-day return is OK)</li>
              <li>✓ Placement class and intake activity completed</li>
            </ul>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use <strong className="text-foreground">Reset</strong> to clear the form, or the <strong className="text-foreground">Intake History</strong> tab to review today&apos;s registrations. Contact your Data Lead for duplicates, address corrections, or cabinet issues.
          </p>
      </CardContent>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .intake-member-guide-card,
          .intake-member-guide-card * {
            visibility: visible !important;
          }
          .intake-member-guide-card {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            padding: 0.4in;
          }
          .intake-member-guide-card .print\\:hidden {
            display: none !important;
          }
          #intake-member-guide-print {
            display: block !important;
          }
        }
      `}</style>
    </Card>
  );
}

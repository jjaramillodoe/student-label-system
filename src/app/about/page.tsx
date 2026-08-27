import Link from 'next/link';
import { Building2, Code2, ExternalLink, Heart, Mail, Sparkles } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import {
  PRODUCT_ACKNOWLEDGEMENTS,
  PRODUCT_DEDICATION,
  PRODUCT_DEVELOPER,
  developerCreditLine,
} from '@/lib/credits';

export default function AboutPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <PageIntro
        eyebrow="Help"
        title="About"
        description="Student Label System for NYC DOE Adult Education programs."
        icon={<Code2 className="h-5 w-5 text-primary" />}
      />

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Development</CardTitle>
          <CardDescription>
            Built to support intake, file labeling, and cabinet storage across Adult Education schools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold tracking-tight">{PRODUCT_DEVELOPER.name}</p>
            <p className="text-sm text-muted-foreground">{PRODUCT_DEVELOPER.title}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {PRODUCT_DEVELOPER.organizationFull}
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {developerCreditLine()}. This application supports District 79 Adult Education staff with
            student intake, Avery label printing, archive boxes, and school storage workflows.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={`mailto:${PRODUCT_DEVELOPER.email}`}>
                <Mail className="h-4 w-4" />
                Contact support
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={MINTLIFY_DOCS_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Documentation
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs">In-app guide</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-600/80 dark:text-rose-400/90" />
            {PRODUCT_DEDICATION.headline}
          </CardTitle>
          <CardDescription>For family — the foundation behind every late night and every build.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {PRODUCT_DEDICATION.to.map((person) => (
              <li
                key={person.name}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
              >
                <span className="font-semibold tracking-tight text-foreground">{person.name}</span>
                <span className="text-muted-foreground">— {person.relation}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-rose-200/80 dark:border-rose-900/60 pl-3">
            {PRODUCT_DEDICATION.note}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600/80 dark:text-amber-400/90" />
            {PRODUCT_ACKNOWLEDGEMENTS.headline}
          </CardTitle>
          <CardDescription>
            Leadership who trusted the idea and made space for this tool to serve staff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PRODUCT_ACKNOWLEDGEMENTS.leaders.map((leader) => (
              <div
                key={leader.name}
                className="rounded-lg border border-border bg-muted/20 px-3 py-3"
              >
                <p className="text-sm font-semibold tracking-tight">{leader.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{leader.note}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {PRODUCT_ACKNOWLEDGEMENTS.body}
          </p>
          <Separator />
          <p className="text-sm text-foreground/90 leading-relaxed">
            {PRODUCT_ACKNOWLEDGEMENTS.staffNote}
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} NYC DOE Adult Education · Student Label System
      </p>
    </div>
  );
}

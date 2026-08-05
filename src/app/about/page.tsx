'use client';

import Link from 'next/link';
import { Building2, Code2, ExternalLink, Mail } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import { PRODUCT_DEVELOPER, developerCreditLine } from '@/lib/credits';

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

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} NYC DOE Adult Education · Student Label System
      </p>
    </div>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PrinterConfig() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Printer Configuration
        </CardTitle>
        <CardDescription>
          Brother QL-800 Professional Label Printer Setup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Printer Specifications</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Model: Brother QL-800</li>
            <li>• Speed: Up to 93 labels per minute</li>
            <li>• Resolution: 300 DPI</li>
            <li>• Connectivity: USB</li>
            <li>• Auto Cutter: Yes</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Recommended Label Types</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Brother DK-1201 (1.1" x 3.5") - Student ID Labels</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Brother DK-11208 (1.1" x 2.1") - Compact Labels</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Brother DK-2205 (2.1" x 2.1") - Square Labels</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Brother DK-22208 (2.1" x 2.8") - Extended Labels</span>
            </div>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Print Settings:</strong> Ensure your browser print settings are configured for:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Paper size: Custom (match label dimensions)</li>
              <li>Margins: None (0mm)</li>
              <li>Scale: 100% (no scaling)</li>
              <li>Background graphics: Enabled</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div>
          <h3 className="font-semibold mb-2">Browser Print Setup</h3>
          <div className="space-y-2 text-sm">
            <div>
              <Badge variant="outline" className="mb-1">Chrome/Edge</Badge>
              <p className="text-muted-foreground">
                Settings → More settings → Margins: None, Scale: 100%, Background graphics: ✓
              </p>
            </div>
            <div>
              <Badge variant="outline" className="mb-1">Firefox</Badge>
              <p className="text-muted-foreground">
                Print → More Settings → Margins: None, Scale: 100%, Print Background Colors: ✓
              </p>
            </div>
            <div>
              <Badge variant="outline" className="mb-1">Safari</Badge>
              <p className="text-muted-foreground">
                Print → Show Details → Scale: 100%, Print backgrounds: ✓
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


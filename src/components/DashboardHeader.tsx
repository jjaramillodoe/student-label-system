'use client';

import Link from 'next/link';
import { BookOpen, FileDown, Upload, History, Printer, MoreHorizontal, Settings, ExternalLink, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageIntro from './PageIntro';
import SeedTestData from './SeedTestData';
import SeedCabinets from './SeedCabinets';
import ClearAllData from './ClearAllData';
import { useAppSettings } from '@/lib/useAppSettings';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardHeaderProps {
  schoolName?: string;
  onShowPrinterConfig: () => void;
  onShowPrintHistory: () => void;
  onDownloadTemplate: () => void;
}

export default function DashboardHeader({
  schoolName,
  onShowPrinterConfig,
  onShowPrintHistory,
  onDownloadTemplate,
}: DashboardHeaderProps) {
  const { settings } = useAppSettings();
  const showAdminPanel = settings.showSeedTestData || settings.showSeedCabinets || settings.showClearAllData;

  return (
    <div className="mb-6 space-y-4">
      <PageIntro
        eyebrow="Student Label System"
        title={schoolName || 'Student Dashboard'}
        description="Search, scan, and print labels. Use ⌘K / Ctrl+K to jump to tools."
        icon={<LayoutDashboard className="h-5 w-5 text-primary" />}
        actions={
          <>
            <Button variant="default" className="gap-2" asChild>
              <Link href="/admin/students/bulk-upload">
                <Upload size={16} /> Bulk Upload
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={onShowPrintHistory}
              className="gap-2"
            >
              <History size={16} /> Print History
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <MoreHorizontal size={16} /> More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onDownloadTemplate}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onShowPrinterConfig}>
                  <Printer className="h-4 w-4 mr-2" />
                  Printer Setup
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={MINTLIFY_DOCS_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full docs (Mintlify)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/docs">
                    <BookOpen className="h-4 w-4 mr-2" />
                    In-app guide
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {showAdminPanel && (
        <div className="flex gap-2 items-center flex-wrap rounded-xl border border-dashed bg-muted/30 px-2 py-1.5 ui-enter ui-enter-delay-2">
          <span className="px-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Settings size={14} /> Dev
          </span>
          {settings.showSeedTestData && <SeedTestData />}
          {settings.showSeedCabinets && <SeedCabinets />}
          {settings.showClearAllData && <ClearAllData />}
        </div>
      )}
    </div>
  );
}

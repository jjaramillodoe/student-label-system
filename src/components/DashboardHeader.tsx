'use client';

import Link from 'next/link';
import { BookOpen, FileDown, Upload, History, TrendingUp, Package, Printer, List, MoreHorizontal, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeedTestData from './SeedTestData';
import SeedCabinets from './SeedCabinets';
import ClearAllData from './ClearAllData';
import { useAppSettings } from '@/lib/useAppSettings';
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
    <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Student Label System</p>
        <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-200">
          {schoolName || 'Student Dashboard'}
        </h1>
      </div>
      <div className="flex gap-2 items-center flex-wrap justify-start lg:justify-end">
        <Link href="/admin/students/bulk-upload">
          <Button variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
            <Upload size={16} /> Bulk Upload
          </Button>
        </Link>
        <Button
          variant="default"
          onClick={onShowPrintHistory}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
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
            <DropdownMenuItem asChild>
              <Link href="/docs">
                <BookOpen className="h-4 w-4 mr-2" />
                Docs
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/reports">
                <TrendingUp className="h-4 w-4 mr-2" />
                Reports
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/label-stock">
                <Package className="h-4 w-4 mr-2" />
                Label Stock
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/thoughtspot-analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                ThoughtSpot Analytics
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/audit">
                <List className="h-4 w-4 mr-2" />
                Audit Log
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {showAdminPanel && (
          <div className="flex gap-2 items-center flex-wrap rounded-md border bg-muted/30 p-1">
            <span className="px-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Settings size={14} /> Admin
            </span>
            {settings.showSeedTestData && <SeedTestData />}
            {settings.showSeedCabinets && <SeedCabinets />}
            {settings.showClearAllData && <ClearAllData />}
          </div>
        )}
      </div>
    </div>
  );
}


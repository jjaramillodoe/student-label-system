'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarRange,
  CopyCheck,
  ExternalLink,
  FileText,
  HeartPulse,
  Inbox,
  Info,
  LayoutGrid,
  LineChart,
  List,
  MoveRight,
  Package,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import { extractStudentIdFromQrPayload } from '@/lib/qrPayload';
import { formatFullName, formatFullNameLower } from '@/lib/personName';

type ToolItem = {
  id: string;
  label: string;
  group: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
  external?: boolean;
};

type StudentHit = {
  _id: string;
  firstName?: string;
  lastName?: string;
  labelId?: string;
  studentId?: string;
  dob?: string;
};

export default function CommandPalette() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const userRole = session?.user?.role as string | undefined;
  const isAdmin = userRole === 'Admin';
  const isAdminOrDataLead = ['Admin', 'Data Lead'].includes(userRole || '');
  const canData = ['Admin', 'Data Lead', 'Data Member'].includes(userRole || '');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || status !== 'authenticated' || !canData) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/students');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setStudents(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, status, canData]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const tools = useMemo<ToolItem[]>(() => {
    if (!canData) return [];
    const items: Array<ToolItem & { show: boolean }> = [
      { id: 'dash', label: 'Dashboard', group: 'Navigate', href: '/', icon: FileText, show: true, keywords: 'home students' },
      { id: 'intake', label: 'Intake', group: 'Intake', href: '/intake', icon: UserPlus, show: isAdminOrDataLead, keywords: 'new student enroll' },
      { id: 'students', label: 'All Students', group: 'Students', href: '/admin/students/all', icon: Users, show: true },
      { id: 'enroll', label: 'Enrollment', group: 'Students', href: '/admin/enrollment', icon: UserPlus, show: true },
      { id: 'upload', label: 'Bulk Upload', group: 'Students', href: '/admin/students/bulk-upload', icon: Upload, show: true },
      { id: 'dupes', label: 'Duplicates', group: 'Students', href: '/admin/duplicates', icon: CopyCheck, show: isAdminOrDataLead },
      { id: 'printq', label: 'Print Queue', group: 'Print', href: '/admin/print-queue', icon: Printer, show: isAdminOrDataLead },
      { id: 'stock', label: 'Label Stock', group: 'Print', href: '/admin/label-stock', icon: Package, show: isAdminOrDataLead },
      { id: 'reports', label: 'Print Reports', group: 'Print', href: '/reports', icon: TrendingUp, show: isAdminOrDataLead },
      { id: 'cabinets', label: 'Cabinets', group: 'Storage', href: '/admin/cabinets', icon: LayoutGrid, show: isAdminOrDataLead },
      { id: 'health', label: 'Cabinet Health', group: 'Storage', href: '/admin/cabinet-health', icon: HeartPulse, show: isAdminOrDataLead },
      { id: 'unassigned', label: 'Unassigned', group: 'Storage', href: '/admin/unassigned', icon: Inbox, show: isAdminOrDataLead },
      { id: 'bulkmove', label: 'Bulk Move', group: 'Storage', href: '/admin/bulk-move', icon: MoveRight, show: isAdminOrDataLead },
      { id: 'users', label: 'User Management', group: 'Admin', href: '/admin/users', icon: Users, show: isAdmin },
      { id: 'settings', label: 'App Settings', group: 'Admin', href: '/admin/settings', icon: Settings, show: isAdmin },
      { id: 'schoolyear', label: 'School Year', group: 'Admin', href: '/admin/school-year', icon: CalendarRange, show: isAdminOrDataLead },
      { id: 'cleanup', label: 'Data Cleanup', group: 'Admin', href: '/admin/data-cleanup', icon: Sparkles, show: isAdminOrDataLead },
      { id: 'audit', label: 'Audit Log', group: 'Admin', href: '/audit', icon: List, show: isAdminOrDataLead },
      { id: 'analytics', label: 'Analytics', group: 'Admin', href: '/admin/analytics', icon: BarChart3, show: isAdminOrDataLead, keywords: 'metrics dashboard enrollment' },
      { id: 'motherduck', label: 'MotherDuck Analytics', group: 'Admin', href: '/admin/motherduck-analytics', icon: LineChart, show: isAdmin, keywords: 'warehouse duckdb analytics' },
      { id: 'thoughtspot', label: 'ThoughtSpot Analytics', group: 'Admin', href: '/admin/thoughtspot-analytics', icon: LineChart, show: isAdmin },
      { id: 'validation', label: 'Email Validation', group: 'Admin', href: '/admin/validation', icon: ShieldCheck, show: isAdmin },
      { id: 'docs', label: 'In-app guide', group: 'Help', href: '/docs', icon: BookOpen, show: true },
      { id: 'about', label: 'About', group: 'Help', href: '/about', icon: Info, show: true, keywords: 'credits javier jaramillo district 79' },
      {
        id: 'mintlify',
        label: 'Full docs (Mintlify)',
        group: 'Help',
        href: MINTLIFY_DOCS_URL,
        icon: ExternalLink,
        show: true,
        external: true,
        keywords: 'documentation mintlify',
      },
    ];
    return items.filter(i => i.show).map(({ show: _s, ...rest }) => rest);
  }, [canData, isAdmin, isAdminOrDataLead]);

  const normalized = extractStudentIdFromQrPayload(query).toLowerCase().trim();

  const filteredTools = useMemo(() => {
    if (!normalized) return tools;
    return tools.filter(t => {
      const hay = `${t.label} ${t.group} ${t.keywords || ''}`.toLowerCase();
      return hay.includes(normalized);
    });
  }, [tools, normalized]);

  const filteredStudents = useMemo(() => {
    if (!normalized || normalized.length < 2) return [];
    return students
      .filter(s => {
        const name = formatFullNameLower(s);
        return (
          name.includes(normalized) ||
          (s.labelId || '').toLowerCase().includes(normalized) ||
          (s.studentId || '').toLowerCase().includes(normalized) ||
          (s.dob || '').toLowerCase().includes(normalized) ||
          (s.dob || '').replace(/-/g, '').includes(normalized.replace(/[/-]/g, ''))
        );
      })
      .slice(0, 8);
  }, [students, normalized]);

  type Row =
    | { kind: 'tool'; item: ToolItem }
    | { kind: 'student'; item: StudentHit };

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [
      ...filteredTools.map(item => ({ kind: 'tool' as const, item })),
      ...filteredStudents.map(item => ({ kind: 'student' as const, item })),
    ];
    return list;
  }, [filteredTools, filteredStudents]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runRow = useCallback(
    (row: Row) => {
      setOpen(false);
      if (row.kind === 'tool') {
        if (row.item.external) {
          window.open(row.item.href, '_blank', 'noopener,noreferrer');
        } else {
          router.push(row.item.href);
        }
        return;
      }
      const id = row.item.labelId || row.item.studentId || '';
      router.push(`/?q=${encodeURIComponent(id)}`);
    },
    [router],
  );

  if (status !== 'authenticated' || !canData) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span>Search tools…</span>
        <kbd className="ml-1 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg top-[20%] translate-y-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Search tools and students</DialogTitle>
            <DialogDescription>Jump to admin tools or find a student by name, label ID, or DOB.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools, name, label ID, DOB…"
              className="border-0 shadow-none focus-visible:ring-0 h-12"
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex(i => Math.min(i + 1, Math.max(rows.length - 1, 0)));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && rows[activeIndex]) {
                  e.preventDefault();
                  runRow(rows[activeIndex]);
                }
              }}
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-6 text-center">No matches</p>
            )}
            {filteredTools.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Tools</p>
                {filteredTools.map((item, idx) => {
                  const Icon = item.icon;
                  const rowIndex = idx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left',
                        rowIndex === activeIndex ? 'bg-accent' : 'hover:bg-muted',
                      )}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      onClick={() => runRow({ kind: 'tool', item })}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.group}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {filteredStudents.length > 0 && (
              <div>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Students</p>
                {filteredStudents.map((item, i) => {
                  const rowIndex = filteredTools.length + i;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left',
                        rowIndex === activeIndex ? 'bg-accent' : 'hover:bg-muted',
                      )}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      onClick={() => runRow({ kind: 'student', item })}
                    >
                      <Boxes className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">
                        {formatFullName(item)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.labelId || item.studentId || item.dob}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

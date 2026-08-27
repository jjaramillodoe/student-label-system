'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
  TrendingDown,
  Download,
  History,
  PackagePlus,
  Minus,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LABEL_STOCK_TEMPLATES, getTemplateMeta } from '@/lib/labelStockMeta';

type StockRow = {
  _id: string;
  template: string;
  templateName?: string;
  school?: string;
  currentStock: number;
  unit?: string;
  unitLabel?: string;
  packLabel?: string;
  packSize?: number;
  labelsPerUnit?: number;
  lowStockThreshold?: number;
  costPerSheet?: number;
  totalValue?: number;
  supplier?: string;
  supplierUrl?: string;
  sku?: string;
  reorderQty?: number;
  lastOrderedAt?: string | null;
  notes?: string;
  isLowStock?: boolean;
  daysLeft?: number | null;
  avgPerDay?: number;
  unitsBurned?: number;
};

type StockEvent = {
  _id: string;
  stockId?: string;
  school?: string;
  template?: string;
  templateName?: string;
  type: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  labelCount?: number;
  unitsConsumed?: number;
  packs?: number;
  note?: string;
  createdAt: string;
  user?: { name?: string; email?: string; role?: string } | null;
};

type SchoolOption = { name: string };

const emptyForm = {
  template: '',
  school: '',
  currentStock: 0,
  lowStockThreshold: 100,
  packSize: 100,
  costPerSheet: 0,
  supplier: '',
  supplierUrl: '',
  sku: '',
  reorderQty: 100,
  lastOrderedAt: '',
  notes: '',
};

function formatDaysLeft(daysLeft: number | null | undefined, onHand: number) {
  if (daysLeft == null) return onHand > 0 ? 'n/a (no recent burn)' : '0';
  if (daysLeft > 365) return '365+';
  return `~${daysLeft} days`;
}

function formatEventType(type: string) {
  switch (type) {
    case 'print':
      return 'Print';
    case 'restock':
      return 'Restock';
    case 'used':
      return 'Used';
    case 'adjust':
      return 'Adjust';
    case 'ordered':
      return 'Ordered';
    case 'create':
      return 'Created';
    case 'delete':
      return 'Deleted';
    default:
      return type;
  }
}

export default function LabelStockPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role || '';
  const isAdmin = role === 'Admin';
  const userSchool = session?.user?.school || '';

  const [stock, setStock] = useState<StockRow[]>([]);
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<StockRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [adjustItem, setAdjustItem] = useState<StockRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<'restock' | 'used'>('restock');
  const [adjustPacks, setAdjustPacks] = useState(1);
  const [adjustUnits, setAdjustUnits] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [historyStockId, setHistoryStockId] = useState<string | 'all'>('all');
  const [busy, setBusy] = useState(false);

  const activeSchoolFilter = isAdmin ? schoolFilter : userSchool;

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = activeSchoolFilter
        ? `?school=${encodeURIComponent(activeSchoolFilter)}`
        : '';
      const res = await fetch(`/api/label-stock${qs}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStock(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load label stock');
    } finally {
      setLoading(false);
    }
  }, [activeSchoolFilter]);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (historyStockId !== 'all') params.set('stockId', historyStockId);
      if (activeSchoolFilter) params.set('school', activeSchoolFilter);
      const res = await fetch(`/api/label-stock/history?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      /* non-blocking */
    }
  }, [historyStockId, activeSchoolFilter]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchStock();
    fetchHistory();
  }, [status, fetchStock, fetchHistory]);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return;
    fetch('/api/admin/schools')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.schools || [];
        setSchools(
          list
            .map((s: { name?: string }) => ({ name: s.name || '' }))
            .filter((s: SchoolOption) => s.name),
        );
      })
      .catch(() => undefined);
  }, [status, isAdmin]);

  useEffect(() => {
    if (!isAdmin && userSchool) {
      setForm((f) => ({ ...f, school: userSchool }));
    }
  }, [isAdmin, userSchool]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        school: isAdmin ? form.school : userSchool,
        lastOrderedAt: form.lastOrderedAt || null,
      };
      const res = await fetch('/api/label-stock', {
        method: editingStock ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingStock ? { ...payload, _id: editingStock._id } : payload,
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await fetchStock();
      await fetchHistory();
      setShowDialog(false);
      setForm({ ...emptyForm, school: isAdmin ? '' : userSchool });
      setEditingStock(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save label stock');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this stock entry? History events are kept.')) return;
    try {
      const res = await fetch(`/api/label-stock?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchStock();
      await fetchHistory();
    } catch {
      setError('Failed to delete stock entry');
    }
  }

  async function handleAdjust() {
    if (!adjustItem) return;
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        stockId: adjustItem._id,
        action: adjustMode,
        note: adjustNote || undefined,
      };
      if (adjustMode === 'restock') {
        if (adjustPacks > 0) body.packs = adjustPacks;
        else body.units = adjustUnits;
      } else {
        body.units = adjustUnits;
      }
      await postAdjust(body);
      setAdjustItem(null);
      setAdjustNote('');
      setAdjustPacks(1);
      setAdjustUnits(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setBusy(false);
    }
  }

  async function postAdjust(body: Record<string, unknown>) {
    const res = await fetch('/api/label-stock/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Adjust failed');
    await fetchStock();
    await fetchHistory();
  }

  async function handleMarkOrdered(item: StockRow) {
    setBusy(true);
    try {
      await postAdjust({
        stockId: item._id,
        action: 'ordered',
        reorderQty: item.reorderQty,
        note: 'Marked as ordered',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark ordered');
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickRestock(item: StockRow) {
    setBusy(true);
    setError('');
    try {
      await postAdjust({
        stockId: item._id,
        action: 'restock',
        packs: 1,
        note: `+1 ${item.packLabel || 'pack'}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restock');
    } finally {
      setBusy(false);
    }
  }

  function openEditDialog(stockItem: StockRow) {
    const meta = getTemplateMeta(stockItem.template);
    setEditingStock(stockItem);
    setForm({
      template: stockItem.template,
      school: stockItem.school || userSchool || '',
      currentStock: stockItem.currentStock,
      lowStockThreshold: stockItem.lowStockThreshold || 100,
      packSize: stockItem.packSize || meta.defaultPackSize,
      costPerSheet: stockItem.costPerSheet || 0,
      supplier: stockItem.supplier || '',
      supplierUrl: stockItem.supplierUrl || '',
      sku: stockItem.sku || '',
      reorderQty: stockItem.reorderQty || meta.defaultPackSize,
      lastOrderedAt: stockItem.lastOrderedAt
        ? String(stockItem.lastOrderedAt).slice(0, 10)
        : '',
      notes: stockItem.notes || '',
    });
    setShowDialog(true);
  }

  function openAddDialog() {
    setEditingStock(null);
    const meta = getTemplateMeta('avery5163');
    setForm({
      ...emptyForm,
      template: 'avery5163',
      school: isAdmin ? schoolFilter || '' : userSchool,
      packSize: meta.defaultPackSize,
      reorderQty: meta.defaultPackSize,
    });
    setShowDialog(true);
  }

  const selectedMeta = getTemplateMeta(form.template || 'avery5163');

  useEffect(() => {
    if (!showDialog || editingStock) return;
    setForm((f) => ({
      ...f,
      packSize: selectedMeta.defaultPackSize,
      reorderQty: selectedMeta.defaultPackSize,
    }));
  }, [form.template, showDialog, editingStock, selectedMeta.defaultPackSize]);

  const lowStockItems = stock.filter((item) => item.isLowStock);
  const totalCost = stock.reduce((sum, item) => sum + (item.totalValue || 0), 0);

  const exportHref = useMemo(() => {
    const qs = activeSchoolFilter
      ? `?school=${encodeURIComponent(activeSchoolFilter)}`
      : '';
    return `/api/label-stock/export${qs}`;
  }, [activeSchoolFilter]);

  if (status === 'loading') {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">

      <PageIntro
        eyebrow="Print"
        title="Label Stock"
        description="Track sheets (Avery) and labels (Brother), restock quickly, and plan reorders."
        icon={<Package className="h-5 w-5 text-primary" />}
        actions={
          <>
            {isAdmin && (
              <Select
                value={schoolFilter || 'all'}
                onValueChange={(v) => setSchoolFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" asChild>
              <Link href="/admin/print-queue">View Print Queue</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </a>
            </Button>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Stock Entry
            </Button>
          </>
        }
      />

      <Separator />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lowStockItems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            {lowStockItems.length} template(s) at or below threshold. Use restock or mark ordered.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Entries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stock.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Label Stock</CardTitle>
          <CardDescription>
            Avery counts are sheets; Brother counts are individual labels. Prints auto-decrement when
            Word is downloaded or browser print is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : stock.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No stock entries yet</p>
              <Button onClick={openAddDialog} className="mt-4">
                Add First Entry
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>On Hand</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead>~Days Left</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reorder</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((item) => {
                    const unitLabel = item.unitLabel || 'units';
                    const packLabel = item.packLabel || 'pack';
                    return (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium min-w-[12rem]">
                          <div>{item.templateName || item.template}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.labelsPerUnit && item.labelsPerUnit > 1
                              ? `${item.labelsPerUnit} labels / ${unitLabel.slice(0, -1) || 'unit'}`
                              : '1 label per unit'}
                          </div>
                        </TableCell>
                        <TableCell>{item.school || '—'}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {item.currentStock} {unitLabel}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${(item.costPerSheet || 0).toFixed(2)} / {unitLabel.slice(0, -1) || 'unit'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.packSize} / {packLabel}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDaysLeft(item.daysLeft, item.currentStock)}
                          {(item.avgPerDay || 0) > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {(item.avgPerDay || 0).toFixed(1)} {unitLabel}/day
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isLowStock ? 'destructive' : 'default'}>
                            {item.isLowStock ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm min-w-[8rem]">
                          <div>Qty: {item.reorderQty ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.lastOrderedAt
                              ? `Ordered ${new Date(item.lastOrderedAt).toLocaleDateString()}`
                              : 'Not ordered'}
                          </div>
                          {item.sku && (
                            <div className="text-xs text-muted-foreground">SKU {item.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.supplier || '—'}
                          {item.supplierUrl ? (
                            <a
                              href={item.supplierUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 inline-flex text-primary"
                              title="Open supplier link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => handleQuickRestock(item)}
                              disabled={busy}
                              title={`Add one ${packLabel} (${item.packSize} ${unitLabel})`}
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                              +1 {packLabel}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustMode('restock');
                                setAdjustPacks(1);
                                setAdjustUnits(0);
                              }}
                              title="Custom restock"
                            >
                              Restock…
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustMode('used');
                                setAdjustUnits(1);
                                setAdjustPacks(0);
                              }}
                            >
                              <Minus className="h-3.5 w-3.5" />
                              Used
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => handleMarkOrdered(item)}
                              disabled={busy}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Ordered
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setHistoryStockId(item._id)}
                              title="Filter history"
                              aria-label="Filter history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(item)}
                              aria-label="Edit stock item"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item._id)}
                              aria-label="Delete stock item"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Usage History
            </CardTitle>
            <CardDescription>
              Print burn and manual adjustments (who changed what)
            </CardDescription>
          </div>
          <Select
            value={historyStockId}
            onValueChange={(v) => setHistoryStockId(v as string | 'all')}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="All entries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entries</SelectItem>
              {stock.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {(s.templateName || s.template) + (s.school ? ` · ${s.school}` : '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No stock events yet. Downloads, prints, and restocks will appear here.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev._id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatEventType(ev.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ev.templateName || ev.template}
                        {ev.school ? (
                          <div className="text-xs text-muted-foreground">{ev.school}</div>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={
                          ev.delta < 0
                            ? 'text-destructive font-medium'
                            : ev.delta > 0
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : ''
                        }
                      >
                        {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                        {ev.labelCount ? (
                          <div className="text-xs text-muted-foreground">
                            {ev.labelCount} labels
                          </div>
                        ) : null}
                        {ev.packs ? (
                          <div className="text-xs text-muted-foreground">{ev.packs} pack(s)</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ev.quantityBefore} → {ev.quantityAfter}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ev.user?.name || ev.user?.email || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[14rem] truncate">
                        {ev.note || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStock ? 'Edit Stock Entry' : 'Add Stock Entry'}</DialogTitle>
            <DialogDescription>
              One entry per template per school. Units are sheets for Avery and labels for Brother.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Label Template</Label>
              <Select
                value={form.template}
                onValueChange={(value) => setForm({ ...form, template: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_STOCK_TEMPLATES.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tracked in {selectedMeta.unitLabel}
                {selectedMeta.labelsPerUnit > 1
                  ? ` (${selectedMeta.labelsPerUnit} labels per sheet)`
                  : ''}
                . Default pack: {selectedMeta.defaultPackSize} / {selectedMeta.packLabel}.
              </p>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>School</Label>
                <Select
                  value={form.school}
                  onValueChange={(value) => setForm({ ...form, school: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current stock ({selectedMeta.unitLabel})</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.currentStock}
                  onChange={(e) =>
                    setForm({ ...form, currentStock: parseInt(e.target.value) || 0 })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Low stock threshold</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 100 })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pack size ({selectedMeta.unitLabel} / {selectedMeta.packLabel})</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.packSize}
                  onChange={(e) =>
                    setForm({ ...form, packSize: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cost per {selectedMeta.unitLabel.slice(0, -1) || 'unit'} ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPerSheet}
                  onChange={(e) =>
                    setForm({ ...form, costPerSheet: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supplier URL</Label>
              <Input
                value={form.supplierUrl}
                onChange={(e) => setForm({ ...form, supplierUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reorder qty ({selectedMeta.unitLabel})</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reorderQty}
                  onChange={(e) =>
                    setForm({ ...form, reorderQty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last ordered</Label>
                <Input
                  type="date"
                  value={form.lastOrderedAt}
                  onChange={(e) => setForm({ ...form, lastOrderedAt: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditingStock(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : editingStock ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick adjust */}
      <Dialog open={!!adjustItem} onOpenChange={(open) => !open && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustMode === 'restock' ? 'Restock' : 'Record usage'} —{' '}
              {adjustItem?.templateName || adjustItem?.template}
            </DialogTitle>
            <DialogDescription>
              {adjustItem
                ? `On hand: ${adjustItem.currentStock} ${adjustItem.unitLabel || 'units'}. Pack = ${adjustItem.packSize} / ${adjustItem.packLabel || 'pack'}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustMode === 'restock' ? 'default' : 'outline'}
                onClick={() => setAdjustMode('restock')}
              >
                Restock
              </Button>
              <Button
                type="button"
                variant={adjustMode === 'used' ? 'default' : 'outline'}
                onClick={() => setAdjustMode('used')}
              >
                Used
              </Button>
            </div>
            {adjustMode === 'restock' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>+ Packs ({adjustItem?.packLabel || 'pack'}s)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={adjustPacks}
                    onChange={(e) => setAdjustPacks(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Or + units</Label>
                  <Input
                    type="number"
                    min="0"
                    value={adjustUnits}
                    onChange={(e) => {
                      setAdjustUnits(parseInt(e.target.value) || 0);
                      setAdjustPacks(0);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Units used ({adjustItem?.unitLabel})</Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustUnits}
                  onChange={(e) => setAdjustUnits(parseInt(e.target.value) || 0)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={busy}>
              {busy ? 'Saving...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

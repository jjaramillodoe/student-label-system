'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, AlertTriangle, Package, TrendingDown } from 'lucide-react';
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
import AdminHeader from '@/components/AdminHeader';
import { Separator } from '@/components/ui/separator';

const LABEL_TEMPLATES = [
  { key: 'avery5160', name: 'Avery 5160 (3x10 Sheet)' },
  { key: 'avery5163', name: 'Avery 5163 (2x5 Sheet)' },
  { key: 'avery94205', name: 'Avery 94205 (2x5 — 1.5"×3.75")' },
  // Brother QL-800 Compatible Labels
  { key: 'brother1201', name: 'Brother DK-1201 (1.1" x 3.5")' },
  { key: 'brother11208', name: 'Brother DK-11208 (1.1" x 2.1")' },
  { key: 'brother2205', name: 'Brother DK-2205 (2.1" x 2.1")' },
  { key: 'brother22208', name: 'Brother DK-22208 (2.1" x 2.8")' },
];

export default function LabelStockPage() {
  const { data: session, status } = useSession();
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [form, setForm] = useState({
    template: '',
    currentStock: 0,
    lowStockThreshold: 100,
    costPerSheet: 0,
    supplier: '',
    notes: ''
  });

  useEffect(() => {
    if (status === 'authenticated') {
      fetchStock();
    }
  }, [status]);

  async function fetchStock() {
    setLoading(true);
    try {
      const res = await fetch('/api/label-stock');
      const data = await res.json();
      setStock(data);
    } catch (err) {
      setError('Failed to load label stock');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingStock) {
        await fetch('/api/label-stock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, _id: editingStock._id }),
        });
      } else {
        await fetch('/api/label-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      await fetchStock();
      setShowDialog(false);
      setForm({ template: '', currentStock: 0, lowStockThreshold: 100, costPerSheet: 0, supplier: '', notes: '' });
      setEditingStock(null);
    } catch (err) {
      setError('Failed to save label stock');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this stock entry?')) return;
    
    try {
      await fetch(`/api/label-stock?id=${id}`, { method: 'DELETE' });
      await fetchStock();
    } catch (err) {
      setError('Failed to delete stock entry');
    }
  }

  function openEditDialog(stockItem: any) {
    setEditingStock(stockItem);
    setForm({
      template: stockItem.template,
      currentStock: stockItem.currentStock,
      lowStockThreshold: stockItem.lowStockThreshold || 100,
      costPerSheet: stockItem.costPerSheet || 0,
      supplier: stockItem.supplier || '',
      notes: stockItem.notes || ''
    });
    setShowDialog(true);
  }

  const lowStockItems = stock.filter(item => item.currentStock <= item.lowStockThreshold);
  const totalCost = stock.reduce((sum, item) => sum + (item.currentStock * (item.costPerSheet || 0)), 0);

  if (status === 'loading') {
    return (
      <div className="w-full p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <AdminHeader />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Label Stock Management</h1>
          <p className="text-muted-foreground mt-2">
            Track label inventory and manage stock levels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/print-queue">
              View Print Queue
            </Link>
          </Button>
          <Button onClick={() => setShowDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Stock Entry
          </Button>
        </div>
      </div>

      <Separator />

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            {lowStockItems.length} label template(s) are running low on stock. Please reorder soon.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
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
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Label Stock</CardTitle>
          <CardDescription>
            Current inventory levels for each label template
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
              <Button onClick={() => setShowDialog(true)} className="mt-4">
                Add First Entry
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Low Stock Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost per Sheet</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((item) => {
                    const isLowStock = item.currentStock <= item.lowStockThreshold;
                    const totalValue = item.currentStock * (item.costPerSheet || 0);
                    const templateName = LABEL_TEMPLATES.find(t => t.key === item.template)?.name || item.template;

                    return (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium">{templateName}</TableCell>
                        <TableCell>{item.currentStock}</TableCell>
                        <TableCell>{item.lowStockThreshold}</TableCell>
                        <TableCell>
                          <Badge variant={isLowStock ? 'destructive' : 'default'}>
                            {isLowStock ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell>${(item.costPerSheet || 0).toFixed(2)}</TableCell>
                        <TableCell>${totalValue.toFixed(2)}</TableCell>
                        <TableCell>{item.supplier || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item._id)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStock ? 'Edit Stock Entry' : 'Add Stock Entry'}</DialogTitle>
            <DialogDescription>
              {editingStock ? 'Update label stock information' : 'Add a new label stock entry'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Label Template</Label>
              <Select
                value={form.template}
                onValueChange={(value) => setForm({ ...form, template: value })}
                required
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_TEMPLATES.map(template => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input
                  id="currentStock"
                  type="number"
                  min="0"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="0"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 100 })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPerSheet">Cost per Sheet ($)</Label>
                <Input
                  id="costPerSheet"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPerSheet}
                  onChange={(e) => setForm({ ...form, costPerSheet: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
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
                  setForm({ template: '', currentStock: 0, lowStockThreshold: 100, costPerSheet: 0, supplier: '', notes: '' });
                  setEditingStock(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingStock ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


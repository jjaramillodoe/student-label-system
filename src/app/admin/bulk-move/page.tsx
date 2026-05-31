'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRightLeft, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';
import AdminHeader from '@/components/AdminHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Student = {
  _id: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  status?: string;
  email?: string | null;
  school?: string;
  cabinet?: string;
  drawer?: string;
};

type Cabinet = {
  _id: string;
  name: string;
  identifier?: string | null;
  school?: string;
  drawers?: {
    _id: string;
    name: string;
    capacity: number;
    currentCount: number;
  }[];
};

function getCabinetName(cabinet?: Cabinet) {
  if (!cabinet) return 'Unassigned';
  return cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name;
}

export default function BulkMovePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceCabinetId, setSourceCabinetId] = useState('all');
  const [targetCabinetId, setTargetCabinetId] = useState('');
  const [targetDrawerId, setTargetDrawerId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    setLoading(true);
    setError('');

    try {
      const [studentRes, cabinetRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/cabinets'),
      ]);
      const [studentData, cabinetData] = await Promise.all([
        studentRes.json(),
        cabinetRes.json(),
      ]);

      setStudents(Array.isArray(studentData) ? studentData : []);
      setCabinets(Array.isArray(cabinetData) ? cabinetData : []);
    } catch (err) {
      setError('Failed to load students and cabinets');
    } finally {
      setLoading(false);
    }
  }

  const cabinetMap = useMemo(() => new Map(cabinets.map((cabinet) => [cabinet._id, cabinet])), [cabinets]);
  const targetCabinet = cabinetMap.get(targetCabinetId);
  const targetDrawer = targetCabinet?.drawers?.find((drawer) => drawer._id === targetDrawerId);
  const targetAvailable = targetDrawer ? (targetDrawer.capacity || 0) - (targetDrawer.currentCount || 0) : 0;

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase();
    return students.filter((student) => {
      const matchesSource = sourceCabinetId === 'all' || student.cabinet === sourceCabinetId;
      const matchesSearch =
        !query ||
        student.studentId?.toLowerCase().includes(query) ||
        `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query);

      return matchesSource && matchesSearch;
    });
  }, [students, sourceCabinetId, search]);

  function toggleStudent(id: string) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id]
    ));
  }

  function selectVisible() {
    const visibleIds = filteredStudents.map((student) => student._id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => (
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    ));
  }

  async function handleMove() {
    setMoving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selectedIds,
          targetCabinetId,
          targetDrawerId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to move students');
      }

      setSuccess(data.message || `Moved ${data.moved} students`);
      setSelectedIds([]);
      await fetchContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move students');
    } finally {
      setMoving(false);
    }
  }

  const canMove = selectedIds.length > 0 && targetCabinetId && targetDrawerId && selectedIds.length <= targetAvailable;

  return (
    <div className="w-full p-6 space-y-6">
      <AdminHeader />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Bulk Move Students</h1>
          <p className="text-muted-foreground mt-1">
            Select students and move them to a target cabinet/drawer with capacity validation.
          </p>
        </div>
        <Button variant="outline" onClick={fetchContext} disabled={loading || moving} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">Moved</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Move Setup</CardTitle>
          <CardDescription>Choose optional source filter and required destination drawer.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Source Cabinet Filter</Label>
            <Select value={sourceCabinetId} onValueChange={(value) => {
              setSourceCabinetId(value);
              setSelectedIds([]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="All cabinets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cabinets</SelectItem>
                {cabinets.map((cabinet) => (
                  <SelectItem key={cabinet._id} value={cabinet._id}>{getCabinetName(cabinet)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Cabinet</Label>
            <Select value={targetCabinetId} onValueChange={(value) => {
              setTargetCabinetId(value);
              setTargetDrawerId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select target cabinet" />
              </SelectTrigger>
              <SelectContent>
                {cabinets.map((cabinet) => (
                  <SelectItem key={cabinet._id} value={cabinet._id}>{getCabinetName(cabinet)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Drawer</Label>
            <Select value={targetDrawerId} onValueChange={setTargetDrawerId} disabled={!targetCabinet}>
              <SelectTrigger>
                <SelectValue placeholder="Select target drawer" />
              </SelectTrigger>
              <SelectContent>
                {(targetCabinet?.drawers || []).map((drawer) => (
                  <SelectItem key={drawer._id} value={drawer._id}>
                    {drawer.name} ({drawer.currentCount}/{drawer.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              {selectedIds.length} selected. {targetDrawer ? `${targetAvailable} target spaces available.` : 'Select a target drawer.'}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="pl-9 w-64"
              />
            </div>
            <Button onClick={handleMove} disabled={!canMove || moving} className="gap-2">
              {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Move Selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.length > targetAvailable && targetDrawer && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selected students exceed target drawer capacity by {selectedIds.length - targetAvailable}.
              </AlertDescription>
            </Alert>
          )}
          {loading ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading students...
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredStudents.length > 0 && filteredStudents.every((student) => selectedIds.includes(student._id))}
                        onCheckedChange={selectVisible}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Current Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>School</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.slice(0, 100).map((student) => {
                    const cabinet = student.cabinet ? cabinetMap.get(student.cabinet) : undefined;
                    const drawer = cabinet?.drawers?.find((item) => item._id === student.drawer);

                    return (
                      <TableRow key={student._id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(student._id)}
                            onCheckedChange={() => toggleStudent(student._id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student'}</div>
                          <div className="text-xs font-mono text-muted-foreground">{student.studentId || student._id}</div>
                        </TableCell>
                        <TableCell>
                          <div>{getCabinetName(cabinet)}</div>
                          <div className="text-xs text-muted-foreground">{drawer?.name || 'No drawer'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.status || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{student.school || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {filteredStudents.length > 100 && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Showing first 100 matching students. Use search/source filter to narrow the list.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

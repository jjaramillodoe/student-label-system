'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isAllowedAdminUser } from '@/lib/allowedUsers';

export default function SeedCabinets() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userEmail = session?.user?.email;
  const [open, setOpen] = useState(false);
  const [cabinetsPerSchool, setCabinetsPerSchool] = useState(2);
  const [drawersPerCabinet, setDrawersPerCabinet] = useState(5);
  const [drawerCapacity, setDrawerCapacity] = useState(100);
  const [studentsPerCabinet, setStudentsPerCabinet] = useState(10);
  const [utilizationThreshold, setUtilizationThreshold] = useState(80);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Only show for allowed admin users
  if (!isAllowedAdminUser(userEmail, userRole)) {
    return null;
  }

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/seed-cabinets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: (session?.user as any)?.school,
          cabinetsPerSchool,
          drawersPerCabinet,
          drawerCapacity,
          studentsPerCabinet,
          utilizationThreshold
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed cabinets');
      }

      setResult(data);

      // Refresh the page after 3 seconds to show new data
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error: any) {
      setResult({ error: error.message || 'Failed to seed cabinets' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 size={16} /> Seed Smart Cabinets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Cabinet Seeding</DialogTitle>
          <DialogDescription>
            Create cabinets for your assigned school with optional pre-filled students. Cabinets are only created
            if storage utilization is above the threshold (or if no cabinets exist).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cabinetsPerSchool">Cabinets per School</Label>
              <Input
                id="cabinetsPerSchool"
                type="number"
                min="1"
                max="10"
                value={cabinetsPerSchool}
                onChange={(e) => setCabinetsPerSchool(parseInt(e.target.value) || 2)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawersPerCabinet">Drawers per Cabinet</Label>
              <Input
                id="drawersPerCabinet"
                type="number"
                min="1"
                max="10"
                value={drawersPerCabinet}
                onChange={(e) => setDrawersPerCabinet(parseInt(e.target.value) || 5)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawerCapacity">Capacity per Drawer</Label>
              <Input
                id="drawerCapacity"
                type="number"
                min="10"
                max="1000"
                value={drawerCapacity}
                onChange={(e) => setDrawerCapacity(parseInt(e.target.value) || 100)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentsPerCabinet">Students per Cabinet</Label>
              <Input
                id="studentsPerCabinet"
                type="number"
                min="0"
                max={drawersPerCabinet * drawerCapacity}
                value={studentsPerCabinet}
                onChange={(e) => setStudentsPerCabinet(parseInt(e.target.value) || 10)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="utilizationThreshold">Utilization Threshold (%)</Label>
            <Input
              id="utilizationThreshold"
              type="number"
              min="0"
              max="100"
              value={utilizationThreshold}
              onChange={(e) => setUtilizationThreshold(parseInt(e.target.value) || 80)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Only create cabinets if existing utilization is above this percentage (or if no cabinets exist)
            </p>
          </div>

          {result && (
            <div className="space-y-2">
              {result.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{result.message}</strong>
                    </AlertDescription>
                  </Alert>

                  {result.results && (
                    <div className="space-y-2 mt-4">
                      <div className="flex gap-2">
                        <Badge variant="default">
                          {result.results.cabinetsCreated} Cabinets
                        </Badge>
                        <Badge variant="secondary">
                          {result.results.studentsCreated} Students
                        </Badge>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {result.results.schools.map((school: any, idx: number) => (
                          <div key={idx} className="p-2 border rounded text-sm">
                            <div className="font-medium">{school.school}</div>
                            {school.action === 'skipped' ? (
                              <div className="text-muted-foreground text-xs">
                                {school.reason} ({school.utilization?.toFixed(1)}%)
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {school.cabinetsCreated} cabinets, {school.studentsCreated} students
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> This will create cabinets for your assigned school. Each cabinet will be
              created for your assigned school. Each cabinet can be pre-filled with the specified number of students distributed across drawers. The page will
              refresh automatically after successful seeding.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSeed} disabled={loading || studentsPerCabinet > drawersPerCabinet * drawerCapacity}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Create Smart Cabinets
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


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
import { Database, Loader2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { isAllowedAdminUser } from '@/lib/allowedUsers';

export default function SeedTestData() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userEmail = session?.user?.email;
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [seedingCabinets, setSeedingCabinets] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Only show for allowed admin users
  if (!isAllowedAdminUser(userEmail, userRole)) {
    return null;
  }

  const handleSeed = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/seed-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed test data');
      }

      setMessage({ type: 'success', text: data.message || `Successfully created ${data.count} test students` });
      
      // Refresh the page after 2 seconds to show new data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to seed test data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedCabinets = async () => {
    setSeedingCabinets(true);
    setMessage(null);

    try {
      const response = await fetch('/api/seed-cabinets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: (session?.user as any)?.school,
          cabinetsPerSchool: 2,
          drawersPerCabinet: 5,
          drawerCapacity: 100,
          studentsPerCabinet: 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed cabinets');
      }

      setMessage({
        type: 'success',
        text: data.results?.cabinetsCreated > 0
          ? `Created ${data.results.cabinetsCreated} sample cabinets. You can now generate student test data.`
          : data.message || 'Cabinet seeding completed.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to seed cabinets' });
    } finally {
      setSeedingCabinets(false);
    }
  };

  const needsCabinets = message?.type === 'error' && (
    message.text.toLowerCase().includes('no cabinets found') ||
    message.text.toLowerCase().includes('no drawers found')
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Database size={16} /> Seed Test Data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seed Test Data</DialogTitle>
          <DialogDescription>
            Generate sample student records for testing. This will create students with random data
            including names, dates, statuses, and cabinet/drawer assignments.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="count">Number of Students</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="500"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 50)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter a number between 1 and 500. Default is 50.
            </p>
          </div>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {needsCabinets && (
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div>
                  Create sample cabinets for {(session?.user as any)?.school || 'your school'} first, then run student seeding again.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSeedCabinets}
                  disabled={seedingCabinets || loading}
                  className="gap-2"
                >
                  {seedingCabinets ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Cabinets...
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4" />
                      Create Sample Cabinets
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> This will create real student records in the database.
              Make sure you have cabinets and drawers set up first. The page will refresh
              automatically after successful seeding.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSeed} disabled={loading || seedingCabinets || count < 1 || count > 500}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Generate Test Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


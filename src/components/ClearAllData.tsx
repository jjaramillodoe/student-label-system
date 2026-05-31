'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
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
import { Trash2, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isAllowedAdminUser } from '@/lib/allowedUsers';

export default function ClearAllData() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userEmail = session?.user?.email;
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Only show for allowed admin users
  if (!isAllowedAdminUser(userEmail, userRole)) {
    return null;
  }

  const handleClear = async () => {
    if (confirmText !== 'DELETE ALL') {
      setMessage({ type: 'error', text: 'Please type "DELETE ALL" to confirm' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/clear-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear all data');
      }

      setMessage({ type: 'success', text: data.message || 'All data cleared successfully' });
      
      // Refresh the page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to clear all data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 size={16} /> Clear All Data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Clear All Data
          </DialogTitle>
          <DialogDescription>
            This will permanently delete ALL students, cabinets, drawers, print history, and audit logs from the database.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>WARNING:</strong> This action is irreversible. All data will be permanently deleted.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type <strong>DELETE ALL</strong> to confirm:
            </Label>
            <Input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setMessage(null);
              }}
              disabled={loading}
              placeholder="DELETE ALL"
              className="font-mono"
            />
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

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>What will be deleted:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All student records</li>
                <li>All cabinets and drawers</li>
                <li>All print history</li>
                <li>All audit logs</li>
              </ul>
              <p className="mt-2 font-semibold">User accounts will NOT be deleted.</p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setOpen(false);
            setConfirmText('');
            setMessage(null);
          }} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleClear} 
            disabled={loading || confirmText !== 'DELETE ALL'}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, User as UserIcon } from 'lucide-react';

interface AuditLog {
  action: string;
  student: any;
  time: string;
  user?: {
    name: string;
    email: string;
    role: string;
    school: string;
  } | null;
}

interface AuditLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditLog: AuditLog[];
}

export default function AuditLogModal({
  open,
  onOpenChange,
  auditLog,
}: AuditLogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Log
          </DialogTitle>
          <DialogDescription>
            View all actions performed on students
          </DialogDescription>
        </DialogHeader>

        <div className="h-[500px] overflow-y-auto pr-4">
          {auditLog.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No actions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLog.map((log, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-semibold">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{log.time}</span>
                  </div>
                  {log.user && (
                    <div className="flex items-center gap-2 text-sm">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{log.user.name}</span>
                      <span className="text-muted-foreground">({log.user.email})</span>
                      <Badge variant="secondary" className="text-xs">
                        {log.user.role}
                      </Badge>
                      {log.user.school && (
                        <Badge variant="outline" className="text-xs">
                          {log.user.school}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="mt-2">
                    <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                      {JSON.stringify(log.student, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


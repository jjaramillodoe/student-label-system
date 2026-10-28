'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { STUDENT_NOTE_MAX_LENGTH, type StudentNoteView } from '@/lib/studentNotes';

export type NotesStudent = {
  _id: string;
  name: string;
};

type Props = {
  student: NotesStudent | null;
  onClose: () => void;
  /** Called with the new visible note count after a note is added or deleted. */
  onCountChange?: (studentId: string, count: number) => void;
};

function formatNoteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StudentNotesDialog({ student, onClose, onCountChange }: Props) {
  const [notes, setNotes] = useState<StudentNoteView[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const studentId = student?._id;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${id}/notes`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load notes');
      setNotes(data.notes || []);
    } catch (err) {
      setNotes([]);
      setError(err instanceof Error ? err.message : 'Could not load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDraft('');
    setEditingId(null);
    if (studentId) void load(studentId);
  }, [studentId, load]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${studentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save note');
      const next = [data.note as StudentNoteView, ...notes];
      setNotes(next);
      setDraft('');
      onCountChange?.(studentId, next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(noteId: string) {
    if (!studentId || !editDraft.trim()) return;
    setBusyId(noteId);
    setError('');
    try {
      const res = await fetch(`/api/students/${studentId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update note');
      setNotes((prev) => prev.map((n) => (n._id === noteId ? data.note : n)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update note');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteNote(noteId: string) {
    if (!studentId) return;
    if (!window.confirm('Delete this note? It will be hidden from the timeline but kept in the audit log.')) return;
    setBusyId(noteId);
    setError('');
    try {
      const res = await fetch(`/api/students/${studentId}/notes/${noteId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete note');
      const next = notes.filter((n) => n._id !== noteId);
      setNotes(next);
      onCountChange?.(studentId, next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete note');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={Boolean(student)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            Notes · {student?.name}
          </DialogTitle>
          <DialogDescription>
            A timeline of staff notes on this student. No SSN or medical details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={addNote} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Folder pulled for audit by district office"
            maxLength={STUDENT_NOTE_MAX_LENGTH}
            rows={3}
            aria-label="New note"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {draft.length}/{STUDENT_NOTE_MAX_LENGTH} · You can edit your note for 24 hours
            </span>
            <Button type="submit" size="sm" disabled={saving || !draft.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add note
            </Button>
          </div>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
          </p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {notes.map((note) => (
              <li key={note._id} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-amber-400" />
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {note.createdBy?.name || note.createdBy?.email}
                    </span>
                    {note.createdBy?.role ? ` · ${note.createdBy.role}` : ''}
                    {' · '}
                    {formatNoteTime(note.createdAt)}
                    {note.editedAt ? ' · edited' : ''}
                  </p>
                  {editingId !== note._id && (note.canEdit || note.canDelete) && (
                    <div className="flex shrink-0 gap-1">
                      {note.canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label="Edit note"
                          onClick={() => { setEditingId(note._id); setEditDraft(note.body); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {note.canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          aria-label="Delete note"
                          disabled={busyId === note._id}
                          onClick={() => void deleteNote(note._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {editingId === note._id ? (
                  <div className="mt-1 space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={STUDENT_NOTE_MAX_LENGTH}
                      rows={3}
                      aria-label="Edit note"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={busyId === note._id || !editDraft.trim()}
                        onClick={() => void saveEdit(note._id)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{note.body}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { Cabinet } from '@/types/cabinet';

type Props = {
  cabinets: Cabinet[];
  highlightCabinetId?: string | null;
  onUpdated: () => void;
  onSelectCabinet?: (cabinet: Cabinet) => void;
};

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 4;

export default function CabinetFloorMap({
  cabinets,
  highlightCabinetId,
  onUpdated,
  onSelectCabinet,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dragCabinetId, setDragCabinetId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);

  const active = useMemo(
    () => cabinets.filter((c) => (c.status ?? 'Active') !== 'Archived'),
    [cabinets],
  );

  const placed = active.filter((c) => c.mapRow != null && c.mapCol != null);
  const unplaced = active.filter((c) => c.mapRow == null || c.mapCol == null);

  const maxRow = Math.max(
    DEFAULT_ROWS - 1,
    ...placed.map((c) => c.mapRow ?? 0),
  );
  const maxCol = Math.max(
    DEFAULT_COLS - 1,
    ...placed.map((c) => c.mapCol ?? 0),
  );

  async function placeCabinet(cabinetId: string, mapRow: number, mapCol: number) {
    setBusyId(cabinetId);
    setError('');
    try {
      // Clear any cabinet already in that cell
      const occupant = placed.find(
        (c) => c.mapRow === mapRow && c.mapCol === mapCol && c._id !== cabinetId,
      );
      if (occupant) {
        await fetch(`/api/cabinets/${occupant._id}/map`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mapRow: null, mapCol: null }),
        });
      }
      const res = await fetch(`/api/cabinets/${cabinetId}/map`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapRow, mapCol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place cabinet');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place');
    } finally {
      setBusyId(null);
      setDragCabinetId(null);
      setOverCell(null);
    }
  }

  async function unplace(cabinetId: string) {
    setBusyId(cabinetId);
    setError('');
    try {
      const res = await fetch(`/api/cabinets/${cabinetId}/map`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapRow: null, mapCol: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to clear');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear');
    } finally {
      setBusyId(null);
    }
  }

  const cells: Array<{ r: number; c: number; cab: Cabinet | null }> = [];
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      cells.push({
        r,
        c,
        cab: placed.find((cab) => cab.mapRow === r && cab.mapCol === c) || null,
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag a cabinet onto a grid cell to place it. Drop onto another cell to move.
        Double-click a placed cabinet to clear its position.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${maxCol + 1}, minmax(7.5rem, 1fr))`,
          }}
        >
          {cells.map(({ r, c, cab }) => {
            const cellKey = `${r}-${c}`;
            const highlighted =
              cab && highlightCabinetId && cab._id === highlightCabinetId;
            const isOver = overCell === cellKey;
            return (
              <div
                key={cellKey}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCell(cellKey);
                }}
                onDragLeave={() => setOverCell((k) => (k === cellKey ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id =
                    e.dataTransfer.getData('text/cabinet-id') || dragCabinetId;
                  if (id) void placeCabinet(id, r, c);
                }}
                className={`min-h-[4.5rem] rounded-md border p-2 text-left text-xs transition-colors ${
                  isOver
                    ? 'border-primary bg-primary/10'
                    : cab
                      ? highlighted
                        ? 'border-primary bg-primary/10'
                        : 'bg-muted/40'
                      : 'border-dashed bg-transparent'
                }`}
              >
                {cab ? (
                  <button
                    type="button"
                    draggable
                    disabled={busyId === cab._id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/cabinet-id', cab._id!);
                      setDragCabinetId(cab._id!);
                    }}
                    onDragEnd={() => {
                      setDragCabinetId(null);
                      setOverCell(null);
                    }}
                    onDoubleClick={() => void unplace(cab._id!)}
                    onClick={() => onSelectCabinet?.(cab)}
                    className="w-full text-left"
                  >
                    <div className="font-medium truncate flex items-center gap-1">
                      {busyId === cab._id && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {cab.identifier || cab.name}
                    </div>
                    <div className="text-muted-foreground truncate">{cab.name}</div>
                    <div className="text-muted-foreground">
                      {cab.currentCount}/{cab.totalCapacity}
                    </div>
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    R{r} C{c}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Unplaced cabinets — drag onto the grid</Label>
        {unplaced.length === 0 ? (
          <p className="text-sm text-muted-foreground">All active cabinets are placed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unplaced.map((cab) => (
              <Badge
                key={cab._id}
                variant="outline"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/cabinet-id', cab._id!);
                  setDragCabinetId(cab._id!);
                }}
                onDragEnd={() => {
                  setDragCabinetId(null);
                  setOverCell(null);
                }}
                className="cursor-grab active:cursor-grabbing px-2 py-1 gap-1"
              >
                {busyId === cab._id && <Loader2 className="h-3 w-3 animate-spin" />}
                {cab.name}
                {cab.identifier ? ` (${cab.identifier})` : ''}
              </Badge>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

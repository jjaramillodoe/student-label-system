'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bookmark, BookmarkCheck, Trash2, Search, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SavedSearchesProps {
  currentFilters: any;
  onLoadSearch: (filters: any) => void;
}

export default function SavedSearches({ currentFilters, onLoadSearch }: SavedSearchesProps) {
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSearches();
  }, []);

  async function fetchSearches() {
    try {
      const res = await fetch('/api/saved-searches');
      if (!res.ok) {
        throw new Error(`Failed to fetch saved searches: ${res.status}`);
      }

      const data = await res.json();
      setSavedSearches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch saved searches:', error);
      setSavedSearches([]);
    }
  }

  async function saveSearch() {
    if (!searchName.trim()) return;

    setLoading(true);
    try {
      await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          filters: currentFilters
        }),
      });
      setSearchName('');
      setShowSaveDialog(false);
      fetchSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSearch(id: string) {
    try {
      await fetch(`/api/saved-searches?id=${id}`, {
        method: 'DELETE',
      });
      fetchSearches();
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  }

  function loadSearch(search: any) {
    onLoadSearch(search.filters);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Saved Searches
            {savedSearches.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {savedSearches.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {savedSearches.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No saved searches
            </div>
          ) : (
            savedSearches.map((search) => (
              <DropdownMenuItem
                key={search._id}
                className="flex items-center justify-between cursor-pointer"
                onSelect={() => loadSearch(search)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <BookmarkCheck className="h-4 w-4" />
                  <span className="flex-1 truncate">{search.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSearch(search._id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
          <div className="border-t mt-1 pt-1">
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => setShowSaveDialog(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Save Current Search
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Save your current filter settings for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="searchName">Search Name</Label>
              <Input
                id="searchName"
                placeholder="e.g., Active Students 2024"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveSearch();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Current filters will be saved with this name
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveSearch} disabled={loading || !searchName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


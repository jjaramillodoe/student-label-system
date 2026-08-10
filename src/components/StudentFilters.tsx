'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import SavedSearches from './SavedSearches';
import { cn } from '@/lib/utils';

interface StudentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterYear: string;
  onFilterYearChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  advancedFilters: {
    startDate: string;
    endDate: string;
    cabinet: string;
    drawer: string;
    email: string;
  };
  onAdvancedFiltersChange: (filters: any) => void;
  fiscalYears: string[];
  statuses: string[];
  cabinets: any[];
  drawers?: any[];
  onLoadSearch: (filters: any) => void;
  /** Quick chip: only active status */
  needsLabelMode?: boolean;
  onNeedsLabelModeChange?: (value: boolean) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function StudentFilters({
  search,
  onSearchChange,
  filterYear,
  onFilterYearChange,
  filterStatus,
  onFilterStatusChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  advancedFilters,
  onAdvancedFiltersChange,
  fiscalYears,
  statuses,
  cabinets,
  drawers,
  onLoadSearch,
  needsLabelMode,
  onNeedsLabelModeChange,
  searchInputRef,
}: StudentFiltersProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-blue-600">Find & print</h2>
        <div className="flex gap-2 flex-wrap">
          <BarcodeScanner
            onScan={(studentId) => {
              onSearchChange(studentId);
            }}
            onManualEntry={(studentId) => {
              onSearchChange(studentId);
            }}
          />
          <SavedSearches
            currentFilters={{
              search,
              filterYear,
              filterStatus,
              ...advancedFilters
            }}
            onLoadSearch={onLoadSearch}
          />
          <Button
            variant="outline"
            onClick={onToggleAdvancedFilters}
            className="gap-2"
          >
            <Filter size={16} /> {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </Button>
        </div>
      </div>

      {/* Quick filter chips for filing-desk rush */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          size="sm"
          variant={filterStatus === 'Active' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => onFilterStatusChange(filterStatus === 'Active' ? 'all' : 'Active')}
        >
          Active
        </Button>
        {onNeedsLabelModeChange && (
          <Button
            type="button"
            size="sm"
            variant={needsLabelMode ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => onNeedsLabelModeChange(!needsLabelMode)}
            title="Show only students who have never been printed (hides anyone found in print history)"
          >
            Needs label
          </Button>
        )}
        {cabinets.slice(0, 6).map((cabinet: any) => {
          const selected = advancedFilters.cabinet === cabinet._id;
          return (
            <Button
              key={cabinet._id}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              className={cn('h-7 text-xs max-w-[140px] truncate')}
              onClick={() =>
                onAdvancedFiltersChange({
                  ...advancedFilters,
                  cabinet: selected ? 'all' : cabinet._id,
                  drawer: 'all',
                })
              }
              title={cabinet.name}
            >
              {cabinet.identifier || cabinet.name}
            </Button>
          );
        })}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={advancedFilters.startDate}
                onChange={(e) => onAdvancedFiltersChange({ ...advancedFilters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={advancedFilters.endDate}
                onChange={(e) => onAdvancedFiltersChange({ ...advancedFilters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cabinet</label>
              <Select
                value={advancedFilters.cabinet}
                onValueChange={(value) => onAdvancedFiltersChange({ ...advancedFilters, cabinet: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Cabinets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cabinets</SelectItem>
                  {cabinets.map(cabinet => (
                    <SelectItem key={cabinet._id} value={cabinet._id}>
                      {cabinet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Drawer</label>
              <Select
                value={advancedFilters.drawer}
                onValueChange={(value) => onAdvancedFiltersChange({ ...advancedFilters, drawer: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Drawers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drawers</SelectItem>
                  {drawers?.map(drawer => (
                    <SelectItem key={drawer._id} value={drawer._id}>
                      {drawer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Filter by email"
                value={advancedFilters.email}
                onChange={(e) => onAdvancedFiltersChange({ ...advancedFilters, email: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAdvancedFiltersChange({
                startDate: '',
                endDate: '',
                cabinet: 'all',
                drawer: 'all',
                email: ''
              })}
              className="gap-2"
            >
              <X size={16} /> Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Basic Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 items-center">
        <Input
          ref={searchInputRef as any}
          type="text"
          placeholder="Search name, Label ID, Student ID, or DOB…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full sm:w-80"
        />
        <Select value={filterYear} onValueChange={onFilterYearChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {fiscalYears.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

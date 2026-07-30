import React, { useState, useMemo } from "react";
import Barcode from "react-barcode";
import { Edit, Trash2, Eye, Users, MoreVertical, Calendar, MapPin, Hash, ArrowUpDown, ArrowUp, ArrowDown, Link2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatShortDate, parseCalendarDate } from "@/lib/utils";
import { formatFullName, formatFullNameLower } from "@/lib/personName";
import { getStudentStorageDisplay } from "@/lib/studentLocation";
import {
  formatStudentAddressStacked,
  type StudentAddressInput,
} from "@/lib/addressValidation";

export type Student = {
  _id?: string;
  firstName: string;
  lastName: string;
  dob: string;
  fiscalYear: string;
  status: string;
  startDate: string;
  cabinet: string;
  drawer: string;
  drawerSection?: string;
  email?: string | null;
  address?: string | null;
  apt?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  addressStandardized?: {
    address: string;
    apt?: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  /** Barcode printed on the physical label: {year}-{initials}-{counter} */
  labelId?: string;
  /** Demographic ID: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS} */
  studentId?: string;
  agencyId?: string;
  siblingConfirmed?: boolean;
  siblingWith?: string[];
  endDate: string | null;
  archived: boolean;
  school?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
  archiveSchoolYear?: string;
  archiveBoxId?: string;
  createdAt?: string;
};

function studentAddressInput(student: Student): StudentAddressInput {
  if (student.addressStandardized?.address?.trim()) {
    return {
      address: student.addressStandardized.address,
      apt: student.apt || student.addressStandardized.apt,
      city: student.addressStandardized.city,
      state: student.addressStandardized.state,
      zip: student.addressStandardized.zip,
    };
  }
  return {
    address: student.address ?? undefined,
    apt: student.apt ?? undefined,
    city: student.city ?? undefined,
    state: student.state ?? undefined,
    zip: student.zip ?? undefined,
  };
}

interface StudentTableProps {
  students: Student[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  someSelected?: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onDetails: (student: Student) => void;
  userRole: string;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
}

type SortColumn = 'studentId' | 'name' | 'address' | 'dob' | 'fiscalYear' | 'status' | 'location' | 'startDate' | null;
type SortDirection = 'asc' | 'desc' | null;

const StudentTable: React.FC<StudentTableProps> = ({
  students,
  selectedIds,
  onSelect,
  onSelectAll,
  allSelected,
  someSelected = false,
  onEdit,
  onDelete,
  onDetails,
  userRole,
  cabinetMap,
  drawerMap,
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'graduated':
        return 'outline';
      case 'withdrawn':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'transferred':
        return 'outline';
      case 'archived':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return formatShortDate(dateString) ?? dateString;
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction: asc -> desc -> null (no sort)
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    if (!sortColumn || !sortDirection) return students;

    return [...students].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'studentId':
          aValue = a.labelId || a.studentId || '';
          bValue = b.labelId || b.studentId || '';
          break;
        case 'name':
          aValue = formatFullNameLower(a);
          bValue = formatFullNameLower(b);
          break;
        case 'address': {
          const aAddr = formatStudentAddressStacked(studentAddressInput(a));
          const bAddr = formatStudentAddressStacked(studentAddressInput(b));
          aValue = [aAddr?.streetLine, aAddr?.cityStateZip].filter(Boolean).join(' ').toLowerCase();
          bValue = [bAddr?.streetLine, bAddr?.cityStateZip].filter(Boolean).join(' ').toLowerCase();
          break;
        }
        case 'dob':
          aValue = parseCalendarDate(a.dob)?.getTime() ?? 0;
          bValue = parseCalendarDate(b.dob)?.getTime() ?? 0;
          break;
        case 'fiscalYear':
          aValue = a.fiscalYear || '';
          bValue = b.fiscalYear || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'location': {
          const aLoc = getStudentStorageDisplay(a, cabinetMap, drawerMap);
          const bLoc = getStudentStorageDisplay(b, cabinetMap, drawerMap);
          aValue = `${aLoc.primary} ${aLoc.secondary}`.toLowerCase();
          bValue = `${bLoc.primary} ${bLoc.secondary}`.toLowerCase();
          break;
        }
        case 'startDate':
          aValue = parseCalendarDate(a.startDate)?.getTime() ?? 0;
          bValue = parseCalendarDate(b.startDate)?.getTime() ?? 0;
          break;
        default:
          return 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sortColumn, sortDirection, cabinetMap, drawerMap]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground opacity-50" />;
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table className="table-fixed w-max max-w-full">
          <colgroup>
            <col style={{ width: '2.5rem' }} />
            <col style={{ width: '10.5rem' }} />
            <col style={{ width: '11.5rem' }} />
            <col style={{ width: '12.5rem' }} />
            <col style={{ width: '6.25rem' }} />
            <col style={{ width: '5.5rem' }} />
            <col style={{ width: '6.25rem' }} />
            <col style={{ width: '8.25rem' }} />
            <col style={{ width: '5.5rem' }} />
            <col style={{ width: '2.5rem' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="sticky left-0 bg-muted/50 z-10 px-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={onSelectAll}
                  aria-label="Select all on this page"
                  title="Select / deselect this page"
                />
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('studentId')}
              >
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span>Label ID</span>
                    <span className="text-[10px] font-normal text-muted-foreground">Student ID</span>
                  </div>
                  <SortIcon column="studentId" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1.5">
                  Name
                  <SortIcon column="name" />
                </div>
              </TableHead>
              <TableHead
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('address')}
              >
                <div className="flex items-center gap-1.5">
                  Address
                  <SortIcon column="address" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('dob')}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  DOB
                  <SortIcon column="dob" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('fiscalYear')}
              >
                <div className="flex items-center gap-1.5">
                  FY
                  <SortIcon column="fiscalYear" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1.5">
                  Status
                  <SortIcon column="status" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  Location
                  <SortIcon column="location" />
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none px-2"
                onClick={() => handleSort('startDate')}
              >
                <div className="flex items-center gap-1.5">
                  Start
                  <SortIcon column="startDate" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center px-1"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-8">
                    <div className="rounded-full bg-muted p-4">
                      <Users className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">No students found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or add a new student</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedStudents.map((student) => {
                const isSelected = selectedIds.includes(student._id!);
                const storage = getStudentStorageDisplay(student, cabinetMap, drawerMap, { showSection: true });
                
                return (
                  <TableRow
                    key={student._id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <TableCell className="sticky left-0 bg-background z-10 px-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onSelect(student._id!)}
                        aria-label={`Select ${formatFullName(student)}`}
                      />
                    </TableCell>
                    <TableCell className="px-2 align-top">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col gap-0.5 cursor-help min-w-0">
                              <span className="font-mono text-sm font-medium truncate">
                                {student.labelId || student.studentId || '—'}
                              </span>
                              {student.studentId && student.labelId && (
                                <span className="font-mono text-[11px] text-muted-foreground truncate" title={student.studentId}>
                                  {student.studentId}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="flex flex-col items-center gap-2 p-2">
                              {(student.labelId || student.studentId) && (
                                <Barcode
                                  value={student.labelId || student.studentId || ''}
                                  width={1.5}
                                  height={40}
                                  fontSize={12}
                                  margin={0}
                                />
                              )}
                              <div className="text-left w-full space-y-0.5">
                                <p className="text-xs text-muted-foreground">Label ID</p>
                                <p className="text-xs font-mono font-medium">{student.labelId || student.studentId || '—'}</p>
                                {student.studentId && student.labelId && (
                                  <>
                                    <p className="text-xs text-muted-foreground mt-1">Student ID</p>
                                    <p className="text-xs font-mono font-medium break-all">{student.studentId}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="px-2 align-top min-w-0">
                      <button
                        onClick={() => onDetails(student)}
                        className="font-medium text-primary hover:underline cursor-pointer text-left w-full min-w-0"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="leading-snug truncate">{formatFullName(student)}</span>
                          {student.email && (
                            <span className="text-xs text-muted-foreground font-normal truncate" title={student.email}>
                              {student.email}
                            </span>
                          )}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="px-2 align-top min-w-0">
                      {(() => {
                        const stacked = formatStudentAddressStacked(studentAddressInput(student));
                        if (!stacked?.streetLine && !stacked?.cityStateZip) {
                          return <span className="text-muted-foreground text-xs">—</span>;
                        }
                        const full = [stacked.streetLine, stacked.cityStateZip].filter(Boolean).join(', ');
                        return (
                          <div className="flex flex-col gap-0.5 text-xs leading-snug min-w-0" title={full}>
                            {stacked.streetLine ? (
                              <span className="font-medium truncate">{stacked.streetLine}</span>
                            ) : null}
                            {stacked.cityStateZip ? (
                              <span className="text-muted-foreground truncate">{stacked.cityStateZip}</span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm px-2 align-top">
                      {formatDate(student.dob)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 align-top">
                      <Badge variant="outline" className="font-normal">
                        {student.fiscalYear}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 align-top">
                      <div className="flex flex-col gap-1 min-w-0">
                        <Badge variant={getStatusVariant(student.status) as any} className="font-normal w-fit">
                          {student.status}
                        </Badge>
                        {(student as any).siblingFlag && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
                            Sibling flag
                          </span>
                        )}
                        {student.siblingConfirmed && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-0.5">
                            <Link2 className="h-3 w-3" />
                            {student.siblingWith?.length
                              ? `${student.siblingWith.length} sibling`
                              : 'Sibling'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 align-top">
                      <div className="flex flex-col gap-0.5 text-xs leading-snug min-w-0">
                        <div className="flex items-baseline gap-1 min-w-0">
                          <span className="text-muted-foreground shrink-0">{storage.primaryLabel}:</span>
                          <span
                            className={cn(
                              'font-medium truncate',
                              storage.isArchived && storage.primary === 'No box assigned' && 'text-amber-700 dark:text-amber-400',
                            )}
                            title={storage.primary}
                          >
                            {storage.primary}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 min-w-0">
                          <span className="text-muted-foreground shrink-0">{storage.secondaryLabel}:</span>
                          <span
                            className={cn(
                              'font-medium truncate',
                              storage.isArchived && storage.secondary.includes('Move to boxes') && 'text-amber-600 dark:text-amber-500',
                            )}
                            title={storage.secondary}
                          >
                            {storage.secondary}
                          </span>
                        </div>
                        {storage.section ? (
                          <div className="flex items-baseline gap-1 min-w-0">
                            <span className="text-muted-foreground shrink-0">Sec:</span>
                            <span className="font-medium truncate" title={storage.section}>
                              {storage.section}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground px-2 align-top">
                      {formatDate(student.startDate)}
                    </TableCell>
                    <TableCell className="px-1 align-top">
                      <TooltipProvider>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => onDetails(student)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(student)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {['Data Lead', 'Admin'].includes(userRole) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(student._id!)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StudentTable; 
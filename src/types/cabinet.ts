export interface Cabinet {
  _id: string;
  name: string;
  identifier?: string;
  school?: string;
  totalCapacity: number;
  currentCount: number;
  drawers: {
    _id: string;
    name: string;
    capacity: number;
    currentCount: number;
  }[];
  status?: 'Active' | 'Archived';
  archivedAt?: string;
  archiveRecordId?: string;
}

export interface ArchiveBox {
  quantity: number;
  filesPerBox: number;
}

/** Individual physical archive box created when a cabinet is archived. */
export interface PhysicalArchiveBox {
  _id: string;
  label: string;
  boxNumber: number;
  /** Drawer this box maps to, e.g. "Drawer E" */
  drawerName?: string;
  filesPerBox: number;
  maxCapacity: number;
  currentCount: number;
}

export interface CabinetArchiveRecord {
  _id?: string;
  cabinetId: string;
  cabinetName: string;
  cabinetIdentifier?: string | null;
  school?: string | null;
  schoolYear: string;
  boxes: ArchiveBox[];
  /** Expanded physical boxes with QR-friendly IDs */
  physicalBoxes?: PhysicalArchiveBox[];
  totalBoxFiles: number;
  studentCountAtArchive: number;
  location: string;
  archiveDate: string;
  archivedBy: string;
  notes?: string;
  createdAt: string;
} 
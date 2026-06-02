export type IntegrationStatus = {
  id: string;
  label: string;
  configured: boolean;
  note?: string;
};

export type CollectionSizeEntry = {
  name: string;
  count: number;
  storageSizeBytes: number;
};

export type SchoolCountEntry = {
  school: string;
  count: number;
};

export type SystemStats = {
  timestamp: string;
  operational: {
    environment: string;
    vercelUrl?: string;
    gitCommit?: string;
    gitBranch?: string;
    deploymentId?: string;
  };
  database: {
    connected: boolean;
    latencyMs?: number;
    dataSizeBytes: number;
    storageSizeBytes: number;
    indexSizeBytes: number;
    collections: Record<string, number>;
    collectionSizes: CollectionSizeEntry[];
  };
  students: {
    total: number;
    active: number;
    archived: number;
    missingUpdatedAt: number;
    unmigratedStudentIds: number;
    missingCabinet: number;
    syncReadyPercent: number;
    bySchool: SchoolCountEntry[];
  };
  cabinets: {
    total: number;
    totalCapacity: number;
    totalUsed: number;
    utilizationPercent: number;
  };
  activity: {
    auditLogsLast7Days: number;
    printsLast30Days: number;
  };
  sync: {
    apiConfigured: boolean;
    lastExport: {
      exportedAt: string;
      since: string;
      recordCount: number;
      hasMore: boolean;
    } | null;
  };
  appDefaults: {
    currentFiscalYear: string;
    defaultIntakeSessionCount: number;
    defaultIntakeActivityCount: number;
    devToolsVisible: number;
  };
  integrations: IntegrationStatus[];
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

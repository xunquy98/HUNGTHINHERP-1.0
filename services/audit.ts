
import { db } from './db';
import { AuditLog, AuditAction, AuditModule } from '../types';

interface LogAuditParams {
  module: AuditModule;
  entityType: string;
  entityId: string;
  entityCode?: string;
  action: AuditAction;
  summary: string;
  actor: { id: string; name: string };
  before?: any;
  after?: any;
  diff?: any;
  severity?: 'info' | 'warn' | 'error';
  refType?: string;
  refCode?: string;
  tags?: string[];
}

// Strip heavy fields from snapshots to keep DB light
const sanitizeSnapshot = (data: any) => {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  
  // Example: If items array is huge, we might want to truncate or summarize it
  // But for now, we keep it but maybe remove image blobs or logs if they exist
  delete clone.image; // Base64 images are heavy
  delete clone.seedTag; // Implementation detail
  
  return clone;
};

export const logAudit = async (params: LogAuditParams) => {
  try {
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      createdById: params.actor.id,
      createdByName: params.actor.name,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId,
      entityCode: params.entityCode,
      action: params.action,
      summary: params.summary,
      before: sanitizeSnapshot(params.before),
      after: sanitizeSnapshot(params.after),
      diff: params.diff,
      severity: params.severity || 'info',
      refType: params.refType,
      refCode: params.refCode,
      tags: params.tags || [],
    };

    // This will join the current transaction if called within one
    await db.auditLogs.add(entry);
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Silent fail to not block business logic if logging fails (rare with IndexedDB)
  }
};

export interface AuditReportParams {
  from?: number;
  to?: number;
  module?: AuditModule;
  userId?: string;
  refCode?: string;
}

export const generateAuditReport = async (params: AuditReportParams) => {
  let query = db.auditLogs.orderBy('createdAt');
  
  if (params.from && params.to) {
    query = query.filter(l => l.createdAt >= params.from! && l.createdAt <= params.to!);
  } else {
    // Default last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    query = query.filter(l => l.createdAt >= thirtyDaysAgo);
  }

  const logs = await query.reverse().toArray();
  
  // In-memory filtering for complex queries not covered by indexes
  const filtered = logs.filter(log => {
    if (params.module && log.module !== params.module) return false;
    if (params.userId && log.createdById !== params.userId) return false;
    if (params.refCode) {
      if (log.refCode !== params.refCode && log.entityCode !== params.refCode) return false;
    }
    return true;
  });

  const actionCounts: Record<string, number> = {};
  let criticalCount = 0;

  filtered.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    if (log.severity === 'error' || log.severity === 'warn') criticalCount++;
  });

  return {
    total: filtered.length,
    criticalCount,
    topActions: Object.entries(actionCounts).sort((a,b) => b[1] - a[1]).slice(0, 5),
    timeline: filtered,
  };
};
